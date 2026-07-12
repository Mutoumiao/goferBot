#!/usr/bin/env node
/**
 * RAG 端到端验证脚本（不依赖 Web 前端）
 *
 * 覆盖：
 *   1) 基础设施健康（Nest / Knowledge AI / Ollama / 向量维度）
 *   2) Knowledge AI 直连：Ollama 适配器 index + retrieve
 *   3) Nest 业务链：登录 → 建 KB → 上传 → 等索引 → 会话 → SSE 问答
 *
 * 用法（仓库根目录）：
 *   node scripts/verify-rag-e2e.mjs
 *
 * 环境变量（可选）：
 *   NEST_BASE=http://127.0.0.1:3100   # 与 packages/server PORT 默认一致
 *   KAI_BASE=http://127.0.0.1:8090
 *   KAI_TOKEN=dev-token-change-me
 *   WEB_EMAIL=admin@goferbot.local
 *   WEB_PASSWORD=AdminGoferBot2123
 *   OLLAMA_HOST_FROM_DOCKER=http://host.docker.internal:11434
 *   EMBED_MODEL=quentinz/bge-large-zh-v1.5:latest
 *
 * 前置（Admin system_config）：
 *   - chat.defaultProvider → 可用 LLM（baseUrl + apiKey）
 *   - rag.embeddingProvider → 可用 embedding（baseUrl + 非空 apiKey；Ollama 可用占位 key 如 ollama）
 *   - KA /health 为 ok（pg+es）；若 degraded 可 docker restart goferbot-knowledge-ai
 *   - EMBEDDING_DIMENSION 与 embedding 模型维度一致（本机 Ollama BGE 常为 1024）
 */

import { constants, publicEncrypt, randomUUID } from 'node:crypto'
import { execSync } from 'node:child_process'

const NEST = (process.env.NEST_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '')
const KAI = (process.env.KAI_BASE || 'http://127.0.0.1:8090').replace(/\/$/, '')
const KAI_TOKEN = process.env.KAI_TOKEN || 'dev-token-change-me'
const EMAIL = process.env.WEB_EMAIL || 'admin@goferbot.local'
const PASSWORD = process.env.WEB_PASSWORD || 'AdminGoferBot2123'
const OLLAMA_DOCKER = (process.env.OLLAMA_HOST_FROM_DOCKER || 'http://host.docker.internal:11434').replace(
  /\/$/,
  '',
)
const EMBED_MODEL = process.env.EMBED_MODEL || 'quentinz/bge-large-zh-v1.5:latest'

const WEB_COOKIE = 'goferbot_web_access_token'
const results = []

function ok(name, detail = '') {
  results.push({ name, pass: true, detail })
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ name, pass: false, detail })
  console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
}
function section(title) {
  console.log(`\n=== ${title} ===`)
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { res, body, text }
}

function unwrap(body) {
  if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
    return body.data
  }
  return body
}

function cookieFromSetCookie(setCookie, name) {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  // Node fetch may join set-cookie; also try getSetCookie if available
  for (const h of list) {
    if (!h) continue
    for (const part of String(h).split(/,(?=\s*[^;]+=)/)) {
      const line = part.trim()
      if (line.startsWith(`${name}=`)) {
        return line.slice(name.length + 1).split(';')[0]
      }
    }
  }
  return null
}

async function stepHealth() {
  section('1. 基础设施')

  const nest = await jsonFetch(`${NEST}/health`)
  if (nest.res.ok && (unwrap(nest.body)?.status === 'ok' || nest.body?.success)) {
    ok('Nest /health')
  } else {
    fail('Nest /health', `${nest.res.status} ${nest.text.slice(0, 200)}`)
  }

  const kai = await jsonFetch(`${KAI}/health`)
  if (kai.res.ok && kai.body?.status === 'ok') {
    ok('Knowledge AI /health', `pg=${kai.body.postgres?.status} es=${kai.body.elasticsearch?.status}`)
  } else {
    fail('Knowledge AI /health', `${kai.res.status} ${kai.text.slice(0, 200)}`)
  }

  try {
    const dim = execSync(
      'docker exec goferbot-knowledge-ai printenv EMBEDDING_DIMENSION',
      { encoding: 'utf8' },
    ).trim()
    if (dim === '1024') ok('EMBEDDING_DIMENSION', dim)
    else fail('EMBEDDING_DIMENSION', `期望 1024，实际 ${dim}`)
  } catch (e) {
    fail('EMBEDDING_DIMENSION', e.message)
  }

  try {
    const col = execSync(
      `docker exec goferbot-postgres psql -U gofer -d goferbot -t -A -c "SELECT a.atttypmod FROM pg_attribute a JOIN pg_class c ON a.attrelid=c.oid JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='knowledge' AND c.relname='chunks' AND a.attname='embedding';"`,
      { encoding: 'utf8' },
    ).trim()
    if (col === '1024') ok('PG vector 列维度', col)
    else fail('PG vector 列维度', `期望 1024，实际 ${col}`)
  } catch (e) {
    fail('PG vector 列维度', e.message)
  }

  const tags = await jsonFetch('http://127.0.0.1:11434/api/tags')
  if (tags.res.ok && Array.isArray(tags.body?.models)) {
    const names = tags.body.models.map((m) => m.name)
    const hasEmb = names.some((n) => n.includes('bge-large-zh') || n.includes(EMBED_MODEL.split(':')[0]))
    if (hasEmb) ok('Ollama 模型列表', names.join(', '))
    else fail('Ollama 模型列表', `未找到 embedding 模型: ${names.join(', ')}`)
  } else {
    fail('Ollama /api/tags', `${tags.res.status}`)
  }
}

async function stepKaiDirect() {
  section('2. Knowledge AI 直连（Ollama /api/embed 适配器）')

  const docId = randomUUID()
  const kbId = randomUUID()
  const text =
    '【脚本验证】GoferBot 使用 Ollama 的 BGE embedding 做知识库向量检索。密钥短语：紫金夜航灯塔。'

  const indexPayload = {
    document_id: docId,
    kb_id: kbId,
    text,
    trace_id: `script-index-${Date.now()}`,
    _provider: {
      embedding_model: EMBED_MODEL,
      embedding_api_key: 'ollama',
      embedding_base_url: OLLAMA_DOCKER,
      embedding_provider_kind: 'ollama',
    },
  }

  const idx = await jsonFetch(`${KAI}/index`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KAI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(indexPayload),
  })

  if (idx.res.ok && idx.body?.status === 'ok' && idx.body?.chunk_count > 0) {
    ok('POST /index', `chunks=${idx.body.chunk_count}`)
  } else {
    fail('POST /index', `${idx.res.status} ${idx.text.slice(0, 400)}`)
    return { kbId: null, docId }
  }

  const retrievePayload = {
    query: '紫金夜航灯塔是什么',
    kb_ids: [kbId],
    top_k: 3,
    _provider: indexPayload._provider,
  }

  const ret = await jsonFetch(`${KAI}/retrieve`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KAI_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(retrievePayload),
  })

  if (ret.res.ok && ret.body && ret.body.retrieval_empty === false && (ret.body.chunks?.length ?? 0) > 0) {
    ok('POST /retrieve', `hits=${ret.body.chunks.length} score=${ret.body.chunks[0]?.score}`)
  } else {
    fail('POST /retrieve', `${ret.res.status} ${ret.text.slice(0, 400)}`)
  }

  return { kbId, docId }
}

async function encryptPassword(password) {
  const { body } = await jsonFetch(`${NEST}/api/auth/public-key`)
  const publicKey = unwrap(body)?.publicKey || body?.publicKey
  if (!publicKey) throw new Error('无法获取 RSA publicKey')
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(password),
  )
  return encrypted.toString('base64')
}

async function loginWeb() {
  const encryptedPassword = await encryptPassword(PASSWORD)
  const res = await fetch(`${NEST}/api/web/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, encryptedPassword }),
  })
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  const setCookie =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
  const token = cookieFromSetCookie(setCookie, WEB_COOKIE)
  if (!res.ok || !token) {
    throw new Error(`Web 登录失败 ${res.status}: ${text.slice(0, 300)}`)
  }
  return token
}

function authHeaders(token) {
  return {
    Cookie: `${WEB_COOKIE}=${token}`,
    'Content-Type': 'application/json',
  }
}

async function stepNestPipeline() {
  section('3. Nest 业务链（登录 → KB → 上传 → 索引 → Chat SSE）')

  let token
  try {
    token = await loginWeb()
    ok('Web 登录', EMAIL)
  } catch (e) {
    fail('Web 登录', e.message)
    return
  }

  // 创建知识库
  const kbRes = await jsonFetch(`${NEST}/api/knowledge-bases`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      name: `rag-verify-${Date.now()}`,
      description: '脚本自动创建，可删',
    }),
  })
  const kb = unwrap(kbRes.body)
  if (!kbRes.res.ok || !kb?.id) {
    fail('创建知识库', `${kbRes.res.status} ${kbRes.text.slice(0, 300)}`)
    return
  }
  ok('创建知识库', kb.id)

  // multipart 上传
  const content = Buffer.from(
    '【Nest链路验证】文档内容：GoferBot RAG 验证专用。\n唯一检索锚点：青瓷茶盏编号 GB-VERIFY-7788。\n',
    'utf8',
  )
  const form = new FormData()
  form.append('file', new Blob([content], { type: 'text/plain' }), 'rag-verify.txt')

  const uploadRes = await fetch(`${NEST}/api/knowledge-bases/${kb.id}/documents/upload`, {
    method: 'POST',
    headers: { Cookie: `${WEB_COOKIE}=${token}` },
    body: form,
  })
  const uploadText = await uploadRes.text()
  let uploadBody
  try {
    uploadBody = JSON.parse(uploadText)
  } catch {
    uploadBody = uploadText
  }
  const doc = unwrap(uploadBody)
  if (!uploadRes.ok || !doc?.id) {
    fail('上传文档', `${uploadRes.status} ${uploadText.slice(0, 400)}`)
    return
  }
  ok('上传文档', `id=${doc.id} status=${doc.status}`)

  // 轮询文档状态
  const deadline = Date.now() + 180_000
  let finalStatus = doc.status
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const list = await jsonFetch(`${NEST}/api/knowledge-bases/${kb.id}/documents`, {
      headers: authHeaders(token),
    })
    const items = unwrap(list.body)
    const arr = Array.isArray(items) ? items : items?.items || items?.data || []
    const found = arr.find((d) => d.id === doc.id)
    finalStatus = found?.status || finalStatus
    process.stdout.write(`  … 索引状态: ${finalStatus}\r`)
    if (finalStatus === 'ready' || finalStatus === 'failed') break
  }
  console.log('')
  if (finalStatus === 'ready') {
    ok('文档索引完成', finalStatus)
  } else {
    fail('文档索引完成', `最终状态=${finalStatus}（超时或失败，查 Nest/KAI/Worker 日志）`)
    // 仍尝试 chat，便于观察错误
  }

  // 创建会话
  const sessRes = await jsonFetch(`${NEST}/api/sessions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ title: 'rag-verify-session' }),
  })
  const session = unwrap(sessRes.body)
  if (!sessRes.res.ok || !session?.id) {
    fail('创建会话', `${sessRes.res.status} ${sessRes.text.slice(0, 300)}`)
    return
  }
  ok('创建会话', session.id)

  // SSE Chat
  const chatRes = await fetch(`${NEST}/api/chat-messages`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      response_mode: 'streaming',
      conversation_id: session.id,
      query: '青瓷茶盏编号是什么？请根据知识库回答。',
      knowledge_base_ids: [kb.id],
      retrieval_mode: 'strict',
    }),
  })

  if (!chatRes.ok) {
    const t = await chatRes.text()
    fail('Chat SSE', `${chatRes.status} ${t.slice(0, 400)}`)
    return
  }

  const reader = chatRes.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let answer = ''
  let sources = []
  let retrievalEmpty
  let sawMessageEnd = false
  let errorMsg = ''

  const parseBlock = (block) => {
    const lines = block.split('\n')
    let event = 'message'
    let dataStr = ''
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      if (line.startsWith('data:')) dataStr += line.slice(5).trim()
    }
    if (!dataStr) return
    try {
      const data = JSON.parse(dataStr)
      // 兼容 { event, data } 与扁平 chunk
      const payload = data.data && typeof data.data === 'object' ? { ...data, ...data.data } : data
      const ev = data.event || event
      if (ev === 'sources' || payload.sources) {
        sources = payload.sources || data.sources || []
        retrievalEmpty = payload.retrieval_empty ?? data.retrieval_empty
      }
      if (ev === 'message') {
        answer += payload.delta || payload.answer || data.delta || ''
      }
      if (ev === 'message_end') {
        sawMessageEnd = true
        if (payload.answer) answer = payload.answer || answer
        if (payload.retrieval_empty !== undefined) retrievalEmpty = payload.retrieval_empty
      }
      if (ev === 'error') {
        errorMsg = payload.message || payload.error || JSON.stringify(payload)
      }
    } catch {
      /* ignore partial */
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const parts = buf.split('\n\n')
    buf = parts.pop() || ''
    for (const p of parts) parseBlock(p)
  }
  if (buf.trim()) parseBlock(buf)

  if (errorMsg) {
    fail('Chat SSE 内容', errorMsg)
    return
  }
  if (!sawMessageEnd && !answer) {
    fail('Chat SSE 内容', '未收到 message/message_end')
    return
  }
  ok('Chat SSE 完成', `answerLen=${answer.length} sources=${sources.length} retrieval_empty=${retrievalEmpty}`)

  if (sources.length > 0 && retrievalEmpty !== true) {
    ok('检索命中 sources', `n=${sources.length}`)
  } else if (finalStatus === 'ready') {
    fail('检索命中 sources', `sources=${sources.length} retrieval_empty=${retrievalEmpty}`)
  } else {
    fail('检索命中 sources', '索引未 ready，跳过判定为索引问题')
  }

  if (answer && answer.length > 5) {
    ok('生成回答非空', answer.slice(0, 80).replace(/\s+/g, ' '))
  } else {
    fail('生成回答非空', `answer=${JSON.stringify(answer).slice(0, 120)}`)
  }
}

async function main() {
  console.log('GoferBot RAG E2E 验证脚本')
  console.log(`Nest=${NEST}  KAI=${KAI}  Ollama(docker)=${OLLAMA_DOCKER}`)
  console.log(`User=${EMAIL}  Embed=${EMBED_MODEL}`)

  await stepHealth()
  await stepKaiDirect()
  await stepNestPipeline()

  section('汇总')
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass)
  console.log(`通过 ${passed}/${results.length}`)
  if (failed.length) {
    console.log('失败项：')
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
    process.exitCode = 1
  } else {
    console.log('全部通过。')
  }
}

main().catch((e) => {
  console.error('脚本异常:', e)
  process.exitCode = 1
})

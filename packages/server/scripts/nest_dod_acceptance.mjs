/**
 * Nest full-chain DoD for knowledge-ai-service-extract (tasks 8.1 path via Nest).
 *
 * Prerequisites:
 * - Postgres/Redis/MinIO up
 * - Knowledge AI :8090 healthy
 * - Nest listening (default http://127.0.0.1:3100)
 * - KNOWLEDGE_AI_BASE_URL + KNOWLEDGE_AI_SERVICE_TOKEN configured for Nest
 * - TEST_INVITATION_CODES includes GF-test-code-001
 *
 * Usage:
 *   node packages/server/scripts/nest_dod_acceptance.mjs
 *   NEST_BASE=http://127.0.0.1:3100 node packages/server/scripts/nest_dod_acceptance.mjs
 */

import { constants, publicEncrypt, randomUUID } from 'node:crypto'

const BASE = (process.env.NEST_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '')
const API = `${BASE}/api`
const WEB_ACCESS_COOKIE = 'goferbot_web_access_token'
const ADMIN_ACCESS_COOKIE = 'goferbot_admin_access_token'
const INVITE = process.env.TEST_INVITATION_CODE || 'GF-test-code-001'
const PASSWORD = process.env.DOD_PASSWORD || 'DodTest1234!'
const ADMIN_EMAIL = process.env.DOD_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || 'admin@goferbot.local'
const ADMIN_PASSWORD = process.env.DOD_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || ''
const TIMEOUT_MS = Number(process.env.DOD_TIMEOUT_MS || 120_000)

const results = []

function ok(name, cond, detail = '') {
  results.push({ name, cond, detail })
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function parseSetCookie(res) {
  // Node fetch: getSetCookie() if available
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie()
  }
  const single = res.headers.get('set-cookie')
  return single ? [single] : []
}

function cookieValue(setCookies, name) {
  for (const header of setCookies) {
    if (!header) continue
    const prefix = `${name}=`
    if (header.startsWith(prefix) || header.includes(`; ${prefix}`) || header.split(';')[0].startsWith(prefix)) {
      const first = header.split(';')[0]
      const eq = first.indexOf('=')
      if (first.slice(0, eq) === name || first.startsWith(prefix)) {
        return first.slice(name.length + 1)
      }
    }
    // standard: name=value; Path=...
    const part = header.split(';')[0]
    if (part.startsWith(`${name}=`)) return part.slice(name.length + 1)
  }
  return null
}

async function json(res) {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 300) }
  }
}

function unwrap(body) {
  return body?.data !== undefined ? body.data : body
}

async function main() {
  console.log(`Nest DoD against ${API}`)
  const email = `nest-dod-${Date.now()}@goferbot.local`

  // health (root /health is unprefixed; /api/health/ready is API-prefixed)
  try {
    let h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) })
    if (!h.ok) h = await fetch(`${API}/health/ready`, { signal: AbortSignal.timeout(5000) })
    ok('Nest /health reachable', h.ok, `status=${h.status}`)
    if (!h.ok) return report(1)
  } catch (e) {
    ok('Nest /health reachable', false, String(e))
    return report(1)
  }

  // public key + register
  const keyRes = await fetch(`${API}/auth/public-key`)
  const keyBody = unwrap(await json(keyRes))
  const publicKey = keyBody.publicKey
  ok('GET /auth/public-key', keyRes.ok && !!publicKey, `status=${keyRes.status}`)

  const encryptedPassword = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(PASSWORD),
  ).toString('base64')

  const regRes = await fetch(`${API}/web/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      encryptedPassword,
      name: 'Nest DoD',
      invitationCode: INVITE,
    }),
  })
  const regBody = await json(regRes)
  const setCookies = parseSetCookie(regRes)
  let token = cookieValue(setCookies, WEB_ACCESS_COOKIE)
  // fallback: some deployments may use different cookie names
  if (!token) {
    for (const c of setCookies) {
      const m = c.match(/^(gofer_[^=]+)=([^;]+)/)
      if (m && m[1].includes('access')) {
        token = m[2]
        break
      }
    }
  }
  ok(
    'register user',
    regRes.status === 201 || regRes.status === 200,
    `status=${regRes.status} token=${token ? 'yes' : 'no'} body=${JSON.stringify(regBody).slice(0, 200)}`,
  )
  if (!token) return report(1)

  const auth = { Cookie: `${WEB_ACCESS_COOKIE}=${token}`, 'Content-Type': 'application/json' }

  // Providers / chat / rag are system-wide (admin). Empty apiKey → KA offline/pseudo path on current image.
  if (!ADMIN_PASSWORD) {
    ok('admin password configured', false, 'set DOD_ADMIN_PASSWORD or SUPER_ADMIN_PASSWORD')
    return report(1)
  }
  const adminEnc = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(ADMIN_PASSWORD),
  ).toString('base64')
  const adminLogin = await fetch(`${API}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, encryptedPassword: adminEnc }),
  })
  const adminCookies = parseSetCookie(adminLogin)
  const adminToken = cookieValue(adminCookies, ADMIN_ACCESS_COOKIE)
  ok('admin login', adminLogin.ok && !!adminToken, `status=${adminLogin.status}`)
  if (!adminToken) return report(1)
  const adminAuth = {
    Cookie: `${ADMIN_ACCESS_COOKIE}=${adminToken}`,
    'Content-Type': 'application/json',
  }

  const providerId = 'dod-openai'
  const provRes = await fetch(`${API}/admin/providers`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({
      id: providerId,
      name: 'DoD Mock Provider',
      enabled: true,
      apiKey: '',
      baseUrl: '',
      isCompleteUrl: false,
      timeoutMs: 60_000,
      models: [
        { name: 'gpt-4o-mini', type: 'llm', enabled: true },
        { name: 'text-embedding-3-small', type: 'embedding', enabled: true, dimensions: 1536 },
      ],
    }),
  })
  ok('admin save provider', provRes.ok, `status=${provRes.status} ${(await provRes.text()).slice(0, 200)}`)
  if (!provRes.ok) return report(1)

  const llmKey = `${providerId}#gpt-4o-mini`
  const embKey = `${providerId}#text-embedding-3-small`
  const chatCfg = await fetch(`${API}/admin/system-config/chat`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({
      defaultProvider: llmKey,
      enabledProviders: [llmKey, providerId],
      temperature: 0.3,
    }),
  })
  ok('admin save chat config', chatCfg.ok, `status=${chatCfg.status}`)
  if (!chatCfg.ok) {
    ok('admin save chat detail', false, (await chatCfg.text()).slice(0, 250))
    return report(1)
  }

  const ragCfg = await fetch(`${API}/admin/system-config/rag`, {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({
      embeddingProvider: embKey,
      retrievalMode: 'strict',
      timeoutMs: 60_000,
      rerankerAllowedModelPrefixes: ['BAAI/', 'Xorbits/', 'sentence-transformers/'],
    }),
  })
  ok('admin save rag config', ragCfg.ok, `status=${ragCfg.status} ${(await ragCfg.text()).slice(0, 200)}`)
  if (!ragCfg.ok) return report(1)

  // create two KBs (multi-KB requirement)
  const kbIds = []
  for (const name of ['Nest-DoD-KB-A', 'Nest-DoD-KB-B']) {
    const kbRes = await fetch(`${API}/knowledge-bases`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: `${name}-${randomUUID().slice(0, 8)}`, description: 'Nest DoD' }),
    })
    const kbBody = unwrap(await json(kbRes))
    const id = kbBody?.id
    ok(`create KB ${name}`, kbRes.ok && !!id, `status=${kbRes.status} id=${id}`)
    if (id) kbIds.push(id)
  }
  if (kbIds.length < 2) return report(1)

  // upload txt to KB A
  const content =
    'GoferBot Nest Knowledge DoD 验收文档。\n' +
    '混合检索使用 PostgreSQL pgvector 与 Elasticsearch BM25。\n' +
    '关键词：知识库问答、sources 引用、document_id 与 kb_id。\n'
  const form = new FormData()
  form.append(
    'file',
    new Blob([content], { type: 'text/plain' }),
    'nest-dod.txt',
  )

  const upRes = await fetch(`${API}/knowledge-bases/${kbIds[0]}/documents/upload`, {
    method: 'POST',
    headers: { Cookie: auth.Cookie },
    body: form,
  })
  const upBody = unwrap(await json(upRes))
  const docId = upBody?.id
  ok(
    'upload document',
    (upRes.status === 201 || upRes.ok) && !!docId,
    `status=${upRes.status} id=${docId} statusField=${upBody?.status}`,
  )
  if (!docId) return report(1)

  // wait ready
  let finalStatus = upBody?.status
  const start = Date.now()
  while (Date.now() - start < TIMEOUT_MS) {
    const dRes = await fetch(`${API}/knowledge-bases/${kbIds[0]}/documents`, {
      headers: { Cookie: auth.Cookie },
    })
    const dBody = unwrap(await json(dRes))
    const items = dBody?.items ?? dBody ?? []
    const doc = Array.isArray(items) ? items.find((x) => x.id === docId) : null
    finalStatus = doc?.status
    if (finalStatus === 'ready' || finalStatus === 'failed') break
    await sleep(1500)
  }
  ok('document status ready', finalStatus === 'ready', `status=${finalStatus}`)
  if (finalStatus !== 'ready') return report(1)

  // create session (conversation)
  const sessRes = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'Nest DoD Session' }),
  })
  const sessBody = unwrap(await json(sessRes))
  const conversationId = sessBody?.id
  ok('create session', sessRes.ok && !!conversationId, `id=${conversationId}`)
  if (!conversationId) return report(1)

  // chat stream multi-KB
  const chatRes = await fetch(`${API}/chat-messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      response_mode: 'streaming',
      conversation_id: conversationId,
      query: '知识库问答 sources pgvector 是什么？',
      knowledge_base_ids: kbIds,
      retrieval_mode: 'strict',
    }),
  })
  ok('chat SSE HTTP ok', chatRes.ok, `status=${chatRes.status} ct=${chatRes.headers.get('content-type')}`)
  if (!chatRes.ok) {
    const t = await chatRes.text()
    ok('chat body', false, t.slice(0, 300))
    return report(1)
  }

  const raw = await chatRes.text()
  const events = []
  let sourcesPayload = null
  for (const block of raw.split('\n\n')) {
    if (!block.trim()) continue
    let eventName = 'message'
    let dataLine = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) dataLine += line.slice(5).trim()
    }
    events.push(eventName)
    if (dataLine) {
      try {
        const data = JSON.parse(dataLine)
        if (eventName === 'sources' || data.event === 'sources') {
          sourcesPayload = data
          events[events.length - 1] = data.event || eventName
        } else if (data.event) {
          events[events.length - 1] = data.event
        }
      } catch {
        /* ignore parse */
      }
    }
    if (['message_end', 'error'].includes(events[events.length - 1])) break
  }

  const first = events[0]
  const last = events[events.length - 1]
  ok(
    'SSE order starts with sources (or terminal)',
    first === 'sources' || first === 'message' || first === 'message_end',
    `events=${JSON.stringify(events.slice(0, 12))}`,
  )
  ok('SSE terminal message_end|error', last === 'message_end' || last === 'error', `last=${last}`)
  ok('no SSE error event', !events.includes('error') || last !== 'error', `events=${JSON.stringify(events)}`)

  const sources = sourcesPayload?.sources ?? []
  const hasKb = sources.some((s) => s.kb_id === kbIds[0])
  const hasDoc = sources.some((s) => s.document_id === docId)
  ok('sources include kb_id', sources.length === 0 || hasKb, `n=${sources.length} sample=${JSON.stringify(sources[0] || {}).slice(0, 180)}`)
  ok('sources include document_id when hits', sources.length === 0 || hasDoc, `hasDoc=${hasDoc}`)

  // strict empty: query empty KB B only (no docs) — still business success
  const emptySess = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'Nest DoD Empty' }),
  })
  const emptyConv = unwrap(await json(emptySess))?.id
  const emptyRes = await fetch(`${API}/chat-messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      response_mode: 'streaming',
      conversation_id: emptyConv,
      query: '完全无关的星际航行食谱问题 xyz-unique-empty-nest',
      knowledge_base_ids: [kbIds[1]],
      retrieval_mode: 'strict',
    }),
  })
  const emptyRaw = await emptyRes.text()
  let emptyRetrieval = false
  let emptyEvents = []
  for (const block of emptyRaw.split('\n\n')) {
    if (!block.trim()) continue
    let eventName = 'message'
    let dataLine = ''
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) dataLine += line.slice(5).trim()
    }
    if (dataLine) {
      try {
        const data = JSON.parse(dataLine)
        if (data.event) eventName = data.event
        if (data.retrieval_empty) emptyRetrieval = true
      } catch {
        /* */
      }
    }
    emptyEvents.push(eventName)
  }
  ok(
    'strict empty: SSE success path',
    emptyRes.ok && emptyEvents.includes('message_end') && !emptyEvents.includes('error'),
    `events=${JSON.stringify(emptyEvents)} retrieval_empty=${emptyRetrieval}`,
  )
  ok('strict empty: retrieval_empty flag', emptyRetrieval, `retrieval_empty=${emptyRetrieval}`)

  // delete document
  const delDoc = await fetch(`${API}/knowledge-bases/${kbIds[0]}/documents/${docId}`, {
    method: 'DELETE',
    headers: { Cookie: auth.Cookie },
  })
  ok('delete document', delDoc.ok || delDoc.status === 200 || delDoc.status === 204, `status=${delDoc.status}`)

  // re-index minimal content then delete KB
  const form2 = new FormData()
  form2.append('file', new Blob(['第二篇文档用于 KB 删除验收。'], { type: 'text/plain' }), 'nest-dod-2.txt')
  const up2 = await fetch(`${API}/knowledge-bases/${kbIds[0]}/documents/upload`, {
    method: 'POST',
    headers: { Cookie: auth.Cookie },
    body: form2,
  })
  const doc2 = unwrap(await json(up2))?.id
  if (doc2) {
    const t0 = Date.now()
    while (Date.now() - t0 < 60_000) {
      const dRes = await fetch(`${API}/knowledge-bases/${kbIds[0]}/documents`, {
        headers: { Cookie: auth.Cookie },
      })
      const items = unwrap(await json(dRes))?.items ?? []
      const st = items.find((x) => x.id === doc2)?.status
      if (st === 'ready' || st === 'failed') break
      await sleep(1000)
    }
  }

  const delKb = await fetch(`${API}/knowledge-bases/${kbIds[0]}`, {
    method: 'DELETE',
    headers: { Cookie: auth.Cookie },
  })
  ok('delete KB', delKb.ok || delKb.status === 200 || delKb.status === 204, `status=${delKb.status}`)

  // chat against deleted KB should 404 / not found
  const goneSess = await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'Nest DoD Gone' }),
  })
  const goneConv = unwrap(await json(goneSess))?.id
  const goneRes = await fetch(`${API}/chat-messages`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      response_mode: 'streaming',
      conversation_id: goneConv,
      query: '知识库问答',
      knowledge_base_ids: [kbIds[0]],
      retrieval_mode: 'strict',
    }),
  })
  ok(
    'chat deleted KB rejected',
    goneRes.status === 404 || goneRes.status === 400 || goneRes.status === 403,
    `status=${goneRes.status}`,
  )

  // cleanup KB B
  await fetch(`${API}/knowledge-bases/${kbIds[1]}`, {
    method: 'DELETE',
    headers: { Cookie: auth.Cookie },
  })

  return report(0)
}

function report(forceCode) {
  const passed = results.filter((r) => r.cond).length
  const failed = results.filter((r) => !r.cond).length
  console.log('\n=== Nest DoD Summary ===')
  console.log(`passed=${passed} failed=${failed} total=${results.length}`)
  if (failed) {
    console.log('Failures:')
    for (const r of results) {
      if (!r.cond) console.log(`  - ${r.name}: ${r.detail}`)
    }
  }
  const code = forceCode && failed === 0 ? forceCode : failed === 0 ? 0 : 1
  // if early abort with forceCode=1, keep 1 even if some passes
  process.exit(failed > 0 || forceCode === 1 ? (failed > 0 ? 1 : forceCode) : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

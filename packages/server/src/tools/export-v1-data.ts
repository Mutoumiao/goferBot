import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

interface CliArgs {
  dbPath: string
  userId: string
  outputDir: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)

  const dbIdx = args.indexOf('--db')
  const uidIdx = args.indexOf('--user-id')
  const outIdx = args.indexOf('--output')

  if (dbIdx === -1 || uidIdx === -1) {
    console.error('用法: pnpm export:v1 -- --db <path> --user-id <uuid> [--output <dir>]')
    process.exit(1)
  }

  const dbPath = args[dbIdx + 1]
  const userId = args[uidIdx + 1]

  if (!dbPath || !userId) {
    console.error('错误: --db 和 --user-id 参数不能为空')
    process.exit(1)
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    console.error('错误: --user-id 必须是合法 UUID 格式')
    process.exit(1)
  }

  const today = new Date().toISOString().slice(0, 10)
  const outputDir = args[outIdx + 1] || path.join('.', 'v1-export', today)

  return { dbPath, userId, outputDir }
}

function openDb(dbPath: string): ReturnType<typeof Database> {
  if (!fs.existsSync(dbPath)) {
    console.error(`错误: 数据库文件不存在: ${dbPath}`)
    process.exit(2)
  }

  try {
    const db = new Database(dbPath, { readonly: true })
    db.pragma('journal_mode = WAL')
    return db
  } catch (err) {
    console.error('错误: 无法打开数据库文件:', err instanceof Error ? err.message : String(err))
    process.exit(2)
  }
}

function timestampToISO(ts: number): string {
  const ms = ts < 10000000000 ? ts * 1000 : ts
  return new Date(ms).toISOString()
}

interface V1Session {
  id: string
  title: string
  provider: string | null
  model: string | null
  created_at: number
  updated_at: number
}

interface V2Session {
  id: string
  userId: string
  title: string
  provider: string | null
  model: string | null
  createdAt: string
  updatedAt: string
}

function exportSessions(
  db: ReturnType<typeof Database>,
  userId: string,
): string[] {
  let rows: V1Session[]
  try {
    rows = db.prepare('SELECT * FROM sessions').all() as V1Session[]
  } catch {
    console.log('  表 sessions 不存在，跳过')
    return []
  }

  if (rows.length === 0) {
    console.log('  表 sessions: 0 条记录（跳过）')
    return []
  }

  const lines = rows.map((row) => {
    const v2: V2Session = {
      id: row.id,
      userId,
      title: row.title || '导入的对话',
      provider: row.provider || null,
      model: row.model || null,
      createdAt: timestampToISO(row.created_at),
      updatedAt: timestampToISO(row.updated_at),
    }
    return JSON.stringify(v2)
  })

  return lines
}

interface V1Message {
  id: string
  session_id: string
  role: string
  content: string
  created_at: number
}

interface V2Message {
  id: string
  sessionId: string
  role: string
  content: string
  createdAt: string
}

function exportMessages(db: ReturnType<typeof Database>): string[] {
  let rows: V1Message[]
  try {
    rows = db.prepare('SELECT * FROM messages').all() as V1Message[]
  } catch {
    console.log('  表 messages 不存在，跳过')
    return []
  }

  if (rows.length === 0) {
    console.log('  表 messages: 0 条记录（跳过）')
    return []
  }

  return rows.map((row) => {
    const v2: V2Message = {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      createdAt: timestampToISO(row.created_at),
    }
    return JSON.stringify(v2)
  })
}

interface V1KnowledgeBase {
  id: string
  name: string
  created_at: number
  deleted_at: number | null
  is_pinned: number
  sort_order: number
  icon: string
}

interface V2KnowledgeBase {
  id: string
  userId: string
  name: string
  description: string | null
  isPinned: boolean
  sortOrder: number
  icon: string | null
  createdAt: string
  updatedAt: string
}

function exportKnowledgeBases(
  db: ReturnType<typeof Database>,
  userId: string,
): string[] {
  let rows: V1KnowledgeBase[]
  try {
    rows = db
      .prepare('SELECT * FROM knowledge_bases WHERE deleted_at IS NULL')
      .all() as V1KnowledgeBase[]
  } catch {
    console.log('  表 knowledge_bases 不存在，跳过')
    return []
  }

  if (rows.length === 0) {
    console.log('  表 knowledge_bases: 0 条记录（跳过）')
    return []
  }

  return rows.map((row, index) => {
    const v2: V2KnowledgeBase = {
      id: row.id,
      userId,
      name: row.name,
      description: null,
      isPinned: row.is_pinned === 1,
      sortOrder: row.sort_order || index,
      icon: row.icon || null,
      createdAt: timestampToISO(row.created_at),
      updatedAt: timestampToISO(row.created_at),
    }
    return JSON.stringify(v2)
  })
}

function main(): void {
  const { dbPath, userId, outputDir } = parseArgs()

  console.log(`正在打开数据库: ${dbPath}`)
  const db = openDb(dbPath)

  let sessionCount = 0
  let messageCount = 0
  let kbCount = 0

  try {
    fs.mkdirSync(outputDir, { recursive: true })

    console.log('导出会话...')
    const sessionLines = exportSessions(db, userId)
    if (sessionLines.length > 0) {
      const p = path.join(outputDir, 'sessions.ndjson')
      fs.writeFileSync(p, sessionLines.join('\n') + '\n')
      sessionCount = sessionLines.length
      console.log(`  已导出 ${sessionCount} 条 → ${p}`)
    }

    console.log('导出消息...')
    const messageLines = exportMessages(db)
    if (messageLines.length > 0) {
      const p = path.join(outputDir, 'messages.ndjson')
      fs.writeFileSync(p, messageLines.join('\n') + '\n')
      messageCount = messageLines.length
      console.log(`  已导出 ${messageCount} 条 → ${p}`)
    }

    console.log('导出知识库...')
    const kbLines = exportKnowledgeBases(db, userId)
    if (kbLines.length > 0) {
      const p = path.join(outputDir, 'knowledge_bases.ndjson')
      fs.writeFileSync(p, kbLines.join('\n') + '\n')
      kbCount = kbLines.length
      console.log(`  已导出 ${kbCount} 条 → ${p}`)
    }

    console.log('')
    console.log('=== 导出完成 ===')
    console.log(`会话: ${sessionCount}`)
    console.log(`消息: ${messageCount}`)
    console.log(`知识库: ${kbCount}`)
    console.log(`输出目录: ${path.resolve(outputDir)}`)
  } catch (err) {
    console.error('导出过程出错:', err instanceof Error ? err.message : String(err))
    process.exit(3)
  } finally {
    db.close()
  }
}

main()

import fs from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import db from './db.js'
import { getAppDataDir } from './utils.js'

const DOCS_DIR = path.join(getAppDataDir(), 'docs')
const TRASH_DIR = path.join(getAppDataDir(), '.trash')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function syncKnowledgeBasesFromDisk(): void {
  ensureDir(DOCS_DIR)
  ensureDir(TRASH_DIR)

  const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true })
  const physicalDirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({
      name: e.name,
      fullPath: path.join(DOCS_DIR, e.name),
    }))

  const dbRows = db
    .prepare('SELECT id, name, path FROM knowledge_bases WHERE deleted_at IS NULL')
    .all() as Array<{ id: string; name: string; path: string }>

  const dbByName = new Map(dbRows.map((r) => [r.name, r]))

  // 物理有 → 数据库无 / path 漂移
  for (const { name, fullPath } of physicalDirs) {
    const existing = dbByName.get(name)
    if (existing) {
      if (existing.path !== fullPath) {
        db.prepare('UPDATE knowledge_bases SET path = ? WHERE id = ?').run(fullPath, existing.id)
      }
    } else {
      const deleted = db
        .prepare('SELECT id FROM knowledge_bases WHERE name = ? AND deleted_at IS NOT NULL')
        .get(name) as { id: string } | undefined
      if (!deleted) {
        const id = nanoid()
        db.prepare(
          'INSERT INTO knowledge_bases (id, name, path, created_at) VALUES (?, ?, ?, ?)'
        ).run(id, name, fullPath, Date.now())
      }
    }
  }

  // 数据库有 → 物理无：移入回收站
  for (const row of dbRows) {
    if (!fs.existsSync(row.path)) {
      const timestamp = Date.now()
      const trashName = `${row.name}-${timestamp}`
      const trashPath = path.join(TRASH_DIR, trashName)
      db.prepare('UPDATE knowledge_bases SET path = ?, deleted_at = ? WHERE id = ?').run(
        trashPath,
        timestamp,
        row.id
      )
    }
  }
}

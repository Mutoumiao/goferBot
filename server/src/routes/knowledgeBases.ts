import { Hono } from 'hono'
import * as fs from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import db from '../db.js'
import { getAppDataDir } from '../utils.js'
import type { KnowledgeBase, FileItem } from '../types.js'

const app = new Hono()
const DOCS_DIR = path.join(getAppDataDir(), 'docs')
const TRASH_DIR = path.join(getAppDataDir(), '.trash')

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// GET /knowledge-bases — 列出未删除的知识库
app.get('/', (c) => {
  const rows = db
    .prepare('SELECT * FROM knowledge_bases WHERE deleted_at IS NULL ORDER BY is_pinned DESC, sort_order DESC, created_at DESC')
    .all() as KnowledgeBase[]
  return c.json(rows)
})

// POST /knowledge-bases — 创建知识库
app.post('/', async (c) => {
  const body = await c.req.json<{ name: string }>()
  const name = body.name?.trim()

  if (!name) {
    return c.json({ error: 'Name is required' }, 400)
  }

  const existing = db
    .prepare('SELECT id FROM knowledge_bases WHERE name = ? AND deleted_at IS NULL')
    .get(name) as { id: string } | undefined

  if (existing) {
    return c.json({ error: 'Knowledge base already exists' }, 409)
  }

  const id = nanoid()
  const kbPath = path.join(DOCS_DIR, name)
  ensureDir(kbPath)

  db.prepare('INSERT INTO knowledge_bases (id, name, path, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    name,
    kbPath,
    Date.now()
  )

  const created = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBase
  return c.json(created, 201)
})

// PATCH /knowledge-bases/:id — 更新知识库（重命名、图标、置顶）
app.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Partial<Pick<KnowledgeBase, 'name' | 'icon' | 'is_pinned' | 'sort_order'>>>()

  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBase | undefined
  if (!kb || kb.deleted_at) {
    return c.json({ error: 'Not found' }, 404)
  }

  let newName = kb.name
  let newPath = kb.path

  if (body.name !== undefined && body.name.trim() && body.name.trim() !== kb.name) {
    const trimmed = body.name.trim()
    const conflict = db
      .prepare('SELECT id FROM knowledge_bases WHERE name = ? AND deleted_at IS NULL')
      .get(trimmed) as { id: string } | undefined
    if (conflict && conflict.id !== id) {
      return c.json({ error: 'Name already exists' }, 409)
    }
    newName = trimmed
    newPath = path.join(DOCS_DIR, newName)
    if (fs.existsSync(kb.path)) {
      ensureDir(DOCS_DIR)
      fs.renameSync(kb.path, newPath)
    }
  }

  const icon = body.icon !== undefined ? body.icon : kb.icon
  const is_pinned = body.is_pinned !== undefined ? body.is_pinned : kb.is_pinned
  const sort_order = body.sort_order !== undefined ? body.sort_order : kb.sort_order

  db.prepare(
    'UPDATE knowledge_bases SET name = ?, path = ?, icon = ?, is_pinned = ?, sort_order = ? WHERE id = ?'
  ).run(newName, newPath, icon, is_pinned, sort_order, id)

  const updated = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBase
  return c.json(updated)
})

// DELETE /knowledge-bases/:id — 移入回收站
app.delete('/:id', (c) => {
  const id = c.req.param('id')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBase | undefined

  if (!kb || kb.deleted_at) {
    return c.json({ error: 'Not found' }, 404)
  }

  const timestamp = Date.now()
  const trashName = `${kb.name}-${timestamp}`
  const trashPath = path.join(TRASH_DIR, trashName)

  ensureDir(TRASH_DIR)

  if (fs.existsSync(kb.path)) {
    fs.renameSync(kb.path, trashPath)
  }

  db.prepare('UPDATE knowledge_bases SET path = ?, deleted_at = ? WHERE id = ?').run(
    trashPath,
    timestamp,
    id
  )

  return c.json({ success: true })
})

// POST /knowledge-bases/:id/restore — 从回收站恢复
app.post('/:id/restore', (c) => {
  const id = c.req.param('id')
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBase | undefined

  if (!kb || !kb.deleted_at) {
    return c.json({ error: 'Not found or not deleted' }, 404)
  }

  let targetName = kb.name
  let targetPath = path.join(DOCS_DIR, targetName)

  if (fs.existsSync(targetPath)) {
    targetName = `${kb.name}-副本`
    targetPath = path.join(DOCS_DIR, targetName)
  }

  if (fs.existsSync(kb.path)) {
    ensureDir(DOCS_DIR)
    fs.renameSync(kb.path, targetPath)
  }

  db.prepare('UPDATE knowledge_bases SET name = ?, path = ?, deleted_at = NULL WHERE id = ?').run(
    targetName,
    targetPath,
    id
  )

  const restored = db.prepare('SELECT * FROM knowledge_bases WHERE id = ?').get(id) as KnowledgeBase
  return c.json(restored)
})

// GET /knowledge-bases/:id/files?path=... — 列出目录内容
app.get('/:id/files', (c) => {
  const id = c.req.param('id')
  const relativePath = c.req.query('path') || ''
  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  const targetPath = path.join(kb.path, relativePath)

  // 安全检查：确保不越界访问知识库根目录之外
  if (!targetPath.startsWith(kb.path)) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  if (!fs.existsSync(targetPath)) {
    return c.json({ path: relativePath, items: [] })
  }

  const entries = fs.readdirSync(targetPath, { withFileTypes: true })
  const items: FileItem[] = entries.map((entry) => {
    const fullPath = path.join(targetPath, entry.name)
    const stat = fs.statSync(fullPath)
    return {
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.isFile() ? stat.size : undefined,
      updatedAt: stat.mtime.getTime(),
    }
  })

  return c.json({ path: relativePath, items })
})

// POST /knowledge-bases/:id/files — 导入文件
app.post('/:id/files', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ path?: string; files: { name: string; content: string }[] }>()
  const relativePath = body.path || ''
  const files = body.files || []

  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  const targetDir = path.join(kb.path, relativePath)

  if (!targetDir.startsWith(kb.path)) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  ensureDir(targetDir)

  for (const file of files) {
    const filePath = path.join(targetDir, file.name)
    // 安全检查
    if (!filePath.startsWith(kb.path)) {
      return c.json({ error: 'Invalid file name' }, 400)
    }
    fs.writeFileSync(filePath, file.content, 'utf-8')
  }

  return c.json({ imported: files.length })
})

// GET /knowledge-bases/:id/search?q=... — 跨目录搜索文件名
app.get('/:id/search', (c) => {
  const id = c.req.param('id')
  const query = c.req.query('q')?.toLowerCase() || ''

  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  if (!query) {
    return c.json({ query, results: [] })
  }

  const results: Array<FileItem & { relativePath: string }> = []

  function walk(dir: string, relative: string): void {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const entryRel = relative ? `${relative}/${entry.name}` : entry.name
      const entryFull = path.join(dir, entry.name)
      const stat = fs.statSync(entryFull)

      if (entry.isDirectory()) {
        if (entry.name.toLowerCase().includes(query)) {
          results.push({
            name: entry.name,
            type: 'directory',
            updatedAt: stat.mtime.getTime(),
            relativePath: entryRel,
          })
        }
        walk(entryFull, entryRel)
      } else if (entry.name.toLowerCase().includes(query)) {
        results.push({
          name: entry.name,
          type: 'file',
          size: stat.size,
          updatedAt: stat.mtime.getTime(),
          relativePath: entryRel,
        })
      }
    }
  }

  walk(kb.path, '')
  return c.json({ query, results })
})

// POST /knowledge-bases/:id/folders — create new folder
app.post('/:id/folders', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ name: string; path?: string }>()
  const folderName = body.name?.trim()
  const relativePath = body.path || ''

  if (!folderName) {
    return c.json({ error: 'Folder name is required' }, 400)
  }

  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  const targetDir = path.join(kb.path, relativePath, folderName)

  if (!targetDir.startsWith(kb.path)) {
    return c.json({ error: 'Invalid path' }, 400)
  }

  ensureDir(targetDir)

  return c.json({ name: folderName, path: relativePath ? `${relativePath}/${folderName}` : folderName }, 201)
})

// PATCH /knowledge-bases/:id/files/:path — rename file (keeps extension)
app.patch('/:id/files/*', async (c) => {
  const id = c.req.param('id')
  const prefix = `/${id}/files/`
  const filePath = c.req.path.startsWith(prefix) ? c.req.path.slice(prefix.length) : ''
  const body = await c.req.json<{ newName: string }>()
  const newBaseName = body.newName?.trim()

  if (!newBaseName) {
    return c.json({ error: 'New name is required' }, 400)
  }

  const kb = db.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND deleted_at IS NULL').get(id) as
    | KnowledgeBase
    | undefined

  if (!kb) {
    return c.json({ error: 'Not found' }, 404)
  }

  const oldFullPath = path.join(kb.path, filePath)
  if (!oldFullPath.startsWith(kb.path) || !fs.existsSync(oldFullPath)) {
    return c.json({ error: 'File not found' }, 404)
  }

  const ext = path.extname(filePath)
  const dir = path.dirname(filePath)
  const newFileName = ext ? `${newBaseName}${ext}` : newBaseName
  const newFullPath = path.join(kb.path, dir, newFileName)

  if (newFullPath !== oldFullPath && fs.existsSync(newFullPath)) {
    return c.json({ error: 'Name already exists' }, 409)
  }

  fs.renameSync(oldFullPath, newFullPath)

  return c.json({ name: newFileName, path: dir === '.' ? newFileName : `${dir}/${newFileName}` })
})

export default app

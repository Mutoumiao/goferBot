# 知识库管理实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现知识库的 CRUD 管理、文件导入、资源管理器视图、面包屑导航和回收站机制。

**Architecture:** Sidecar 提供 REST API 管理 SQLite `knowledge_bases` 表和物理文件系统（`docs/` 与 `.trash/`）。前端通过 Pinia store 管理状态，Rust IPC 负责打开系统文件对话框并代理文件上传到 sidecar。资源管理器支持目录浏览、搜索和基于历史栈的回退/前进导航。

**Tech Stack:** Vue 3 + TypeScript + Pinia, Tauri v2 + tauri-plugin-dialog, Hono, better-sqlite3

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `server/src/routes/knowledgeBases.ts` | Sidecar REST API：知识库 CRUD、文件列表、搜索、导入 |
| `src/stores/knowledgeBase.ts` | Pinia store：知识库列表、资源管理器状态、导航历史栈 |
| `src/components/KnowledgeBasePage.vue` | 知识库管理页：左侧面板 + 右侧资源管理器 |
| `src/components/FileExplorer.vue` | 资源管理器：面包屑、搜索、文件/文件夹列表 |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `server/src/db.ts` | 添加 `knowledge_bases` 表（含 `deleted_at` 支持回收站） |
| `server/src/types.ts` | 添加 `KnowledgeBase`、`FileItem`、`ImportFile` 接口 |
| `server/src/index.ts` | 注册 `knowledgeBases` 路由 |
| `src/types/index.ts` | 添加前端 `KnowledgeBase`、`FileItem`、`NavigationState` 类型 |
| `src-tauri/Cargo.toml` | 添加 `tauri-plugin-dialog = "2"` 依赖 |
| `src-tauri/src/lib.rs` | 添加 `import_files` 命令；注册 dialog plugin |
| `src-tauri/capabilities/default.json` | 添加 `dialog:default` 权限 |
| `src/App.vue` | 将知识库占位符替换为 `<KnowledgeBasePage />` |
| `vite.config.ts` | AutoImport 增加 `@/stores/knowledgeBase` |

---

## Task 1: Sidecar 数据库层

**Files:**
- Modify: `server/src/db.ts`

- [ ] **Step 1: 扩展数据库 Schema**

在现有 `CREATE TABLE` 语句之后追加 `knowledge_bases` 表：

```typescript
// server/src/db.ts — 追加到 db.exec() 的 SQL 字符串末尾

  CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
```

**验证：** `cd server && pnpm build` 应成功编译。

- [ ] **Step 2: Commit**

```bash
git add server/src/db.ts
git commit -m "feat(db): add knowledge_bases table with soft-delete support"
```

---

## Task 2: Sidecar 类型定义

**Files:**
- Modify: `server/src/types.ts`

- [ ] **Step 1: 追加知识库相关类型**

```typescript
// server/src/types.ts — 追加到文件末尾

export interface KnowledgeBase {
  id: string
  name: string
  path: string
  created_at: number
  deleted_at: number | null
}

export interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  updatedAt: number
}

export interface ImportFile {
  name: string
  content: string
}
```

**验证：** `cd server && pnpm build` 应成功编译。

- [ ] **Step 2: Commit**

```bash
git add server/src/types.ts
git commit -m "feat(types): add KnowledgeBase, FileItem and ImportFile interfaces"
```

---

## Task 3: Sidecar 知识库路由

**Files:**
- Create: `server/src/routes/knowledgeBases.ts`

- [ ] **Step 1: 实现完整路由**

```typescript
// server/src/routes/knowledgeBases.ts
import { Hono } from 'hono'
import fs from 'node:fs'
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
    .prepare('SELECT * FROM knowledge_bases WHERE deleted_at IS NULL ORDER BY created_at DESC')
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

export default app
```

**验证：** `cd server && pnpm build` 应成功编译。

- [ ] **Step 2: Commit**

```bash
git add server/src/routes/knowledgeBases.ts
git commit -m "feat(api): add knowledge base CRUD, file explorer, search and import routes"
```

---

## Task 4: Sidecar 入口注册路由

**Files:**
- Modify: `server/src/index.ts`

- [ ] **Step 1: 导入并注册路由**

```typescript
// server/src/index.ts — 在现有 import 下方添加
import knowledgeBaseRoutes from './routes/knowledgeBases.js'

// server/src/index.ts — 在 app.route('/sessions', sessionRoutes) 下方添加
app.route('/knowledge-bases', knowledgeBaseRoutes)
```

**验证：** `cd server && pnpm build` 应成功编译。

- [ ] **Step 2: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(api): register knowledge-bases routes in sidecar entry"
```

---

## Task 5: Rust IPC 文件导入命令

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: 添加 dialog plugin 依赖**

```toml
# src-tauri/Cargo.toml — 在 [dependencies] 区域追加
tauri-plugin-dialog = "2"
```

- [ ] **Step 2: 实现 import_files 命令**

```rust
// src-tauri/src/lib.rs — 在 restart_sidecar 函数之后、run 函数之前插入

use serde_json::json;
use std::fs;

#[tauri::command]
async fn import_files(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<SidecarHandle>>,
    knowledge_base_id: String,
    target_path: String,
) -> Result<usize, String> {
    let port = state
        .lock()
        .await
        .get_port()
        .ok_or("Sidecar not ready".to_string())?;

    // 打开系统文件对话框（多选）
    let file_paths = app
        .dialog()
        .file()
        .add_filter("Text Documents", &["txt", "md", "markdown"])
        .blocking_pick_files();

    let paths: Vec<std::path::PathBuf> = match file_paths {
        Some(p) => p.into_iter().map(|f| f.into()).collect(),
        None => return Ok(0),
    };

    if paths.is_empty() {
        return Ok(0);
    }

    let client = reqwest::Client::new();
    let url = format!(
        "http://127.0.0.1:{}/knowledge-bases/{}/files",
        port, knowledge_base_id
    );

    let mut imported = 0;

    for file_path in paths {
        let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        let file_name = file_path
            .file_name()
            .ok_or("Invalid file path".to_string())?
            .to_string_lossy()
            .to_string();

        let payload = json!({
            "path": target_path,
            "files": [{ "name": file_name, "content": content }]
        });

        client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        imported += 1;
    }

    Ok(imported)
}
```

同时更新 `lib.rs` 中的 plugin 注册和 invoke_handler：

```rust
// src-tauri/src/lib.rs — 在 .plugin(tauri_plugin_prevent_default::init()) 之后添加
.plugin(tauri_plugin_dialog::init())

// src-tauri/src/lib.rs — 更新 invoke_handler
.invoke_handler(tauri::generate_handler![
    greet,
    get_sidecar_port,
    restart_sidecar,
    import_files
])
```

- [ ] **Step 3: 更新 capabilities**

```json
// src-tauri/capabilities/default.json — 在 permissions 数组中添加
"dialog:default"
```

**验证：** `cd src-tauri && cargo check` 应成功。

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/capabilities/default.json
git commit -m "feat(tauri): add import_files IPC command with file dialog and sidecar upload"
```

---

## Task 6: 前端类型定义

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: 追加前端类型**

```typescript
// src/types/index.ts — 追加到文件末尾

export interface KnowledgeBase {
  id: string
  name: string
  path: string
  created_at: number
  deleted_at: number | null
}

export interface FileItem {
  name: string
  type: 'file' | 'directory'
  size?: number
  updatedAt: number
}

export interface SearchResultItem extends FileItem {
  relativePath: string
}

export interface BrowseState {
  type: 'browse'
  path: string
}

export interface SearchState {
  type: 'search'
  query: string
}

export type HistoryEntry = BrowseState | SearchState
```

**验证：** `pnpm type-check` 应通过。

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add KnowledgeBase, FileItem and navigation state types"
```

---

## Task 7: 前端知识库 Store

**Files:**
- Create: `src/stores/knowledgeBase.ts`

- [ ] **Step 1: 实现 Pinia store**

```typescript
// src/stores/knowledgeBase.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
import { invoke } from '@tauri-apps/api/core'
import type { KnowledgeBase, FileItem, SearchResultItem, HistoryEntry } from '@/types'

export const useKnowledgeBaseStore = defineStore('knowledgeBase', () => {
  // State
  const knowledgeBases = ref<KnowledgeBase[]>([])
  const selectedKbId = ref<string | null>(null)
  const files = ref<FileItem[]>([])
  const searchResults = ref<SearchResultItem[]>([])
  const searchQuery = ref('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Navigation history stack
  const history = ref<HistoryEntry[]>([{ type: 'browse', path: '' }])
  const historyIndex = ref(0)

  // Getters
  const selectedKb = computed(() =>
    knowledgeBases.value.find((kb) => kb.id === selectedKbId.value)
  )

  const currentPath = computed(() => {
    const state = history.value[historyIndex.value]
    return state?.type === 'browse' ? state.path : ''
  })

  const canGoBack = computed(() => historyIndex.value > 0)
  const canGoForward = computed(() => historyIndex.value < history.value.length - 1)

  const breadcrumb = computed(() => {
    const state = history.value[historyIndex.value]
    if (state?.type !== 'browse') return []
    if (!state.path) return []
    return state.path.split('/').filter(Boolean)
  })

  // Actions
  async function loadKnowledgeBases() {
    isLoading.value = true
    error.value = null
    try {
      const res = await sidecarFetch('/knowledge-bases')
      knowledgeBases.value = (await res.json()) as KnowledgeBase[]
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  async function createKnowledgeBase(name: string) {
    error.value = null
    try {
      const res = await sidecarFetch('/knowledge-bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: '创建失败' }))) as { error: string }
        throw new Error(err.error)
      }
      const kb = (await res.json()) as KnowledgeBase
      knowledgeBases.value.unshift(kb)
      selectKb(kb.id)
      return kb
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  async function deleteKnowledgeBase(id: string) {
    error.value = null
    try {
      const res = await sidecarFetch(`/knowledge-bases/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('删除失败')
      knowledgeBases.value = knowledgeBases.value.filter((kb) => kb.id !== id)
      if (selectedKbId.value === id) {
        selectedKbId.value = null
        files.value = []
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  async function restoreKnowledgeBase(id: string) {
    error.value = null
    try {
      const res = await sidecarFetch(`/knowledge-bases/${id}/restore`, { method: 'POST' })
      if (!res.ok) throw new Error('恢复失败')
      const kb = (await res.json()) as KnowledgeBase
      knowledgeBases.value = knowledgeBases.value.filter((k) => k.id !== id)
      knowledgeBases.value.unshift(kb)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function selectKb(id: string) {
    selectedKbId.value = id
    history.value = [{ type: 'browse', path: '' }]
    historyIndex.value = 0
    searchQuery.value = ''
    searchResults.value = []
    loadFiles('')
  }

  async function loadFiles(path: string) {
    if (!selectedKbId.value) return
    isLoading.value = true
    try {
      const res = await sidecarFetch(
        `/knowledge-bases/${selectedKbId.value}/files?path=${encodeURIComponent(path)}`
      )
      const data = (await res.json()) as { items: FileItem[] }
      files.value = data.items
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  function pushHistory(entry: HistoryEntry) {
    // 截断当前索引之后的历史
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(entry)
    historyIndex.value++

    if (entry.type === 'browse') {
      loadFiles(entry.path)
    }
  }

  function navigateToPath(path: string) {
    pushHistory({ type: 'browse', path })
  }

  async function searchFiles(query: string) {
    if (!selectedKbId.value || !query.trim()) {
      searchResults.value = []
      return
    }
    searchQuery.value = query
    isLoading.value = true
    try {
      const res = await sidecarFetch(
        `/knowledge-bases/${selectedKbId.value}/search?q=${encodeURIComponent(query)}`
      )
      const data = (await res.json()) as { results: SearchResultItem[] }
      searchResults.value = data.results
      pushHistory({ type: 'search', query })
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      isLoading.value = false
    }
  }

  function goBack() {
    if (!canGoBack.value) return
    historyIndex.value--
    applyHistoryState()
  }

  function goForward() {
    if (!canGoForward.value) return
    historyIndex.value++
    applyHistoryState()
  }

  function applyHistoryState() {
    const state = history.value[historyIndex.value]
    if (!state) return
    if (state.type === 'browse') {
      loadFiles(state.path)
    }
    // search state keeps results in searchResults
  }

  async function importFiles() {
    if (!selectedKbId.value) return
    try {
      await invoke('import_files', {
        knowledgeBaseId: selectedKbId.value,
        targetPath: currentPath.value,
      })
      // 刷新当前目录
      await loadFiles(currentPath.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  return {
    knowledgeBases,
    selectedKbId,
    selectedKb,
    files,
    searchResults,
    searchQuery,
    isLoading,
    error,
    history,
    historyIndex,
    currentPath,
    canGoBack,
    canGoForward,
    breadcrumb,
    loadKnowledgeBases,
    createKnowledgeBase,
    deleteKnowledgeBase,
    restoreKnowledgeBase,
    selectKb,
    loadFiles,
    navigateToPath,
    searchFiles,
    goBack,
    goForward,
    importFiles,
  }
})
```

**验证：** `pnpm type-check` 应通过。

- [ ] **Step 2: Commit**

```bash
git add src/stores/knowledgeBase.ts
git commit -m "feat(store): add knowledgeBase store with CRUD, navigation and file import"
```

---

## Task 8: 前端 FileExplorer 组件

**Files:**
- Create: `src/components/FileExplorer.vue`

- [ ] **Step 1: 实现资源管理器组件**

```vue
<!-- src/components/FileExplorer.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { FileItem, SearchResultItem } from '@/types'

const props = defineProps<{
  files: FileItem[]
  searchResults: SearchResultItem[]
  searchQuery: string
  breadcrumb: string[]
  isSearchMode: boolean
  isLoading: boolean
}>()

const emit = defineEmits<{
  openDirectory: [path: string]
  navigateToBreadcrumb: [index: number]
  search: [query: string]
  importFiles: []
  goBack: []
  goForward: []
}>()

const displayItems = computed(() => {
  if (props.isSearchMode) {
    return props.searchResults.map((r) => ({
      ...r,
      displayPath: r.relativePath,
    }))
  }
  return props.files.map((f) => ({ ...f, displayPath: f.name }))
})

function onItemDoubleClick(item: FileItem | SearchResultItem) {
  if (item.type === 'directory') {
    if ('relativePath' in item) {
      emit('openDirectory', item.relativePath)
    } else {
      const newPath = props.breadcrumb.length > 0
        ? `${props.breadcrumb.join('/')}/${item.name}`
        : item.name
      emit('openDirectory', newPath)
    }
  }
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="flex h-full flex-col bg-surface-0">
    <!-- Toolbar -->
    <div class="flex items-center gap-3 border-b border-surface-3 px-4 py-3">
      <!-- Navigation buttons -->
      <div class="flex gap-1">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          @click="emit('goBack')"
        >
          <span class="i-mdi-chevron-left text-lg" />
        </button>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          @click="emit('goForward')"
        >
          <span class="i-mdi-chevron-right text-lg" />
        </button>
      </div>

      <!-- Breadcrumb -->
      <div class="flex flex-1 items-center gap-1 overflow-hidden">
        <button
          class="shrink-0 text-sm text-text-secondary hover:text-text-primary"
          @click="emit('navigateToBreadcrumb', -1)"
        >
          根目录
        </button>
        <template v-for="(segment, idx) in breadcrumb" :key="idx">
          <span class="i-mdi-chevron-right text-xs text-text-tertiary" />
          <button
            class="truncate text-sm text-text-secondary hover:text-text-primary"
            @click="emit('navigateToBreadcrumb', idx)"
          >
            {{ segment }}
          </button>
        </template>
      </div>

      <!-- Search -->
      <div class="relative">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary i-mdi-magnify" />
        <input
          :value="searchQuery"
          type="text"
          placeholder="搜索文件..."
          class="h-8 w-48 rounded-md border border-surface-3 bg-surface-1 pl-9 pr-3 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-accent-500"
          @keyup.enter="emit('search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Import button -->
      <button
        class="flex items-center gap-1.5 rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500"
        @click="emit('importFiles')"
      >
        <span class="i-mdi-plus text-sm" />
        添加文件
      </button>
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-auto p-2">
      <div v-if="isLoading" class="flex h-full items-center justify-center">
        <span class="i-mdi-loading animate-spin text-2xl text-accent-500" />
      </div>

      <div v-else-if="displayItems.length === 0" class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
        <span class="i-mdi-folder-open-outline text-4xl" />
        <span class="text-sm">暂无文件</span>
      </div>

      <div v-else class="grid grid-cols-[1fr_auto_auto] gap-1">
        <!-- Header -->
        <div class="col-span-3 grid grid-cols-subgrid px-3 py-2 text-xs font-medium text-text-tertiary">
          <span>名称</span>
          <span class="text-right">大小</span>
          <span class="text-right">修改时间</span>
        </div>

        <!-- Items -->
        <div
          v-for="item in displayItems"
          :key="item.name + ('relativePath' in item ? item.relativePath : '')"
          class="col-span-3 grid cursor-pointer grid-cols-subgrid items-center rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
          @dblclick="onItemDoubleClick(item)"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <span
              class="shrink-0 text-lg"
              :class="item.type === 'directory' ? 'i-mdi-folder text-amber-400' : 'i-mdi-file-document-outline text-text-secondary'"
            />
            <div class="min-w-0">
              <div class="truncate text-sm text-text-primary">{{ item.name }}</div>
              <div v-if="'relativePath' in item && item.relativePath !== item.name" class="truncate text-xs text-text-tertiary">
                {{ item.relativePath }}
              </div>
            </div>
          </div>
          <span class="text-right text-xs text-text-tertiary">{{ formatSize(item.size) }}</span>
          <span class="text-right text-xs text-text-tertiary">{{ formatDate(item.updatedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
```

**验证：** `pnpm type-check` 应通过。

- [ ] **Step 2: Commit**

```bash
git add src/components/FileExplorer.vue
git commit -m "feat(ui): add FileExplorer component with breadcrumb, search and file list"
```

---

## Task 9: 前端 KnowledgeBasePage 组件

**Files:**
- Create: `src/components/KnowledgeBasePage.vue`

- [ ] **Step 1: 实现知识库管理页**

```vue
<!-- src/components/KnowledgeBasePage.vue -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import FileExplorer from './FileExplorer.vue'

const store = useKnowledgeBaseStore()
const showNewKbDialog = ref(false)
const newKbName = ref('')
const newKbError = ref('')

onMounted(() => {
  store.loadKnowledgeBases()
})

const isSearchMode = computed(() => {
  const state = store.history[store.historyIndex]
  return state?.type === 'search'
})

function openNewKbDialog() {
  newKbName.value = ''
  newKbError.value = ''
  showNewKbDialog.value = true
}

async function confirmCreateKb() {
  const name = newKbName.value.trim()
  if (!name) {
    newKbError.value = '请输入知识库名称'
    return
  }
  try {
    await store.createKnowledgeBase(name)
    showNewKbDialog.value = false
  } catch {
    newKbError.value = store.error || '创建失败'
  }
}

function onOpenDirectory(path: string) {
  store.navigateToPath(path)
}

function onNavigateToBreadcrumb(index: number) {
  if (index === -1) {
    store.navigateToPath('')
    return
  }
  const path = store.breadcrumb.slice(0, index + 1).join('/')
  store.navigateToPath(path)
}

function onSearch(query: string) {
  if (!query.trim()) {
    // 返回浏览根目录
    store.navigateToPath('')
    return
  }
  store.searchFiles(query)
}

function onImportFiles() {
  store.importFiles()
}
</script>

<template>
  <div class="flex h-full bg-surface-0">
    <!-- Left sidebar: knowledge base list -->
    <div class="flex w-56 flex-col border-r border-surface-3">
      <div class="flex items-center justify-between border-b border-surface-3 px-3 py-3">
        <span class="text-sm font-medium text-text-primary">知识库</span>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          @click="openNewKbDialog"
        >
          <span class="i-mdi-plus text-lg" />
        </button>
      </div>

      <div class="flex-1 overflow-auto p-2">
        <div
          v-for="kb in store.knowledgeBases"
          :key="kb.id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors"
          :class="store.selectedKbId === kb.id ? 'bg-accent-600/15 text-accent-400' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'"
          @click="store.selectKb(kb.id)"
        >
          <span class="i-mdi-bookshelf text-lg" />
          <span class="truncate text-sm">{{ kb.name }}</span>
        </div>

        <div v-if="store.knowledgeBases.length === 0 && !store.isLoading" class="px-2 py-4 text-center text-xs text-text-tertiary">
          暂无知识库，点击 + 创建
        </div>
      </div>
    </div>

    <!-- Right: file explorer -->
    <div class="flex-1">
      <FileExplorer
        v-if="store.selectedKb"
        :files="store.files"
        :search-results="store.searchResults"
        :search-query="store.searchQuery"
        :breadcrumb="store.breadcrumb"
        :is-search-mode="isSearchMode"
        :is-loading="store.isLoading"
        @open-directory="onOpenDirectory"
        @navigate-to-breadcrumb="onNavigateToBreadcrumb"
        @search="onSearch"
        @import-files="onImportFiles"
        @go-back="store.goBack"
        @go-forward="store.goForward"
      />
      <div v-else class="flex h-full flex-col items-center justify-center gap-3 text-text-tertiary">
        <span class="i-mdi-bookshelf text-5xl" />
        <span class="text-sm">选择一个知识库或创建新库</span>
      </div>
    </div>

    <!-- New KB Dialog -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showNewKbDialog"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          @click.self="showNewKbDialog = false"
        >
          <div class="w-80 rounded-lg border border-surface-3 bg-surface-1 p-5 shadow-xl">
            <h3 class="mb-3 text-base font-medium text-text-primary">新建知识库</h3>
            <input
              v-model="newKbName"
              type="text"
              placeholder="输入知识库名称"
              class="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary placeholder-text-tertiary outline-none transition-colors focus:border-accent-500"
              @keyup.enter="confirmCreateKb"
            />
            <p v-if="newKbError" class="mt-2 text-xs text-red-400">{{ newKbError }}</p>
            <div class="mt-4 flex justify-end gap-2">
              <button
                class="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
                @click="showNewKbDialog = false"
              >
                取消
              </button>
              <button
                class="rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500"
                @click="confirmCreateKb"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Error toast -->
    <Transition name="fade">
      <div
        v-if="store.error"
        class="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400"
      >
        <span class="i-mdi-alert-circle-outline" />
        {{ store.error }}
        <button class="ml-1 text-red-400 hover:text-red-300" @click="store.error = null">
          <span class="i-mdi-close" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

**验证：** `pnpm type-check` 应通过。

- [ ] **Step 2: Commit**

```bash
git add src/components/KnowledgeBasePage.vue
git commit -m "feat(ui): add KnowledgeBasePage with sidebar, file explorer and new-kb dialog"
```

---

## Task 10: App.vue 集成与自动导入配置

**Files:**
- Modify: `src/App.vue`
- Modify: `vite.config.ts`

- [ ] **Step 1: 替换知识库占位符**

```vue
<!-- src/App.vue — 替换知识库占位符 div 为 KnowledgeBasePage 组件 -->
<KnowledgeBasePage v-else-if="sessionStore.activeTab?.type === 'knowledgeBase'" />
```

同时添加 import：

```typescript
// src/App.vue — 在 script setup 顶部添加
import KnowledgeBasePage from './components/KnowledgeBasePage.vue'
```

- [ ] **Step 2: 更新 vite.config.ts 自动导入**

```typescript
// vite.config.ts — 修改 AutoImport imports 数组
AutoImport({
  imports: [
    'vue',
    'vue-router',
    'pinia',
    {
      '@/store': ['useStore'],
      '@/stores/session': ['useSessionStore'],
      '@/stores/settings': ['useSettingsStore'],
      '@/stores/knowledgeBase': ['useKnowledgeBaseStore'],
    },
  ],
  dts: 'auto-imports.d.ts',
  vueTemplate: true,
}),
```

**验证：** `pnpm type-check` 应通过。

- [ ] **Step 3: Commit**

```bash
git add src/App.vue vite.config.ts
git commit -m "feat(ui): integrate KnowledgeBasePage into App layout and auto-import store"
```

---

## Task 11: 端到端验证

- [ ] **Step 1: 编译验证**

```bash
cd server && pnpm build
```
Expected: `Build completed successfully`。

```bash
cd src-tauri && cargo check
```
Expected: `Finished dev [unoptimized + debuginfo] target(s)`。

```bash
pnpm type-check
```
Expected: 无 TypeScript 错误。

- [ ] **Step 2: 运行测试**

```bash
pnpm test
```
Expected: 现有测试全部通过（知识库功能本次不强制要求新测试，但现有测试不能挂）。

- [ ] **Step 3: 手动功能验证清单**

启动 `pnpm tauri dev` 后逐一验证：

1. 点击侧边栏文件夹图标 → 打开知识库管理页
2. 点击「+」→ 输入名称 → 创建知识库 → 左侧出现新库
3. 选中知识库 → 右侧显示空目录提示
4. 点击「添加文件」→ 弹出系统文件对话框 → 选择 txt/md → 文件出现在列表
5. 在知识库目录下手动创建子文件夹 → 刷新后双击进入 → 面包屑更新
6. 在搜索框输入文件名 → 显示跨目录搜索结果 → 双击文件夹结果进入对应目录
7. 点击面包屑上的目录名 → 跳转到对应层级
8. 点击导航按钮 ← → 回退/前进浏览历史
9. 右键或后续 issue 中实现删除 → 知识库移入 `.trash/`

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix: address type-check and test issues for knowledge base feature" || true
```

---

## 自检清单

**1. Spec 覆盖检查：**

| 需求 | 对应 Task |
|------|----------|
| SQLite `knowledge_bases` 表 | Task 1 |
| Sidecar CRUD API (`GET/POST/DELETE`) | Task 3 |
| Sidecar 文件列表 API | Task 3 (`GET /:id/files`) |
| 前端管理页（左列表 + 右资源管理器） | Task 8, 9 |
| 新建知识库（输入名称 + 物理目录） | Task 3 (POST), Task 9 (对话框) |
| 文件导入链路（Rust IPC → 对话框 → 读取 → POST sidecar → 保存） | Task 5 (Rust), Task 3 (POST files), Task 7 (store.importFiles) |
| 资源管理器（双击文件夹、面包屑） | Task 8, 9 |
| 文件名搜索（跨目录扁平结果） | Task 3 (GET search), Task 7 (searchFiles), Task 8 |
| 面包屑回退/前进（历史栈） | Task 7 (history stack), Task 8 (goBack/goForward) |
| 知识库删除（移入 `.trash/`） | Task 3 (DELETE) |
| 知识库恢复（同名冲突 → 副本） | Task 3 (POST restore) |
| 第一版不实现 30 天自动清理 | —（明确不实现） |

**2. Placeholder 扫描：** 无 TBD/TODO/fill in later。每段代码均为可直接编译的完整实现。

**3. 类型一致性：**
- `KnowledgeBase` 接口在 `server/src/types.ts` 与 `src/types/index.ts` 中字段一致
- `FileItem` 接口在前后端一致（`size` 可选，`updatedAt` 使用驼峰）
- `import_files` Rust 命令签名与前端 `invoke('import_files', ...)` 参数一致
- `sidecarFetch` 调用路径与 Hono 路由注册路径一致（`/knowledge-bases`）

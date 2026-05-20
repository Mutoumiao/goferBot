# CLI 规格：V1 数据导出工具

> 注意：本功能为 CLI 工具，无 REST API。此规格描述命令行接口。

## 命令

```bash
pnpm export:v1 -- --db <path> --user-id <uuid> [--output <dir>]
```

## 参数

| 参数 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `--db` | 是 | string (path) | V1 SQLite 数据库文件路径 |
| `--user-id` | 是 | string (uuid) | V2 目标用户 ID，导出数据归属此用户 |
| `--output` | 否 | string (path) | 输出目录，默认 `./v1-export/YYYY-MM-DD/` |

## 退出码

| 码 | 含义 |
|----|------|
| 0 | 导出成功 |
| 1 | 参数错误（缺必填参数 / userId 格式错误） |
| 2 | 数据库文件不存在或无法打开 |
| 3 | 数据库读取错误（损坏 / 权限不足） |
| 4 | 输出目录不可写 |

## 输出文件

```
v1-export/2026-05-18/
├── sessions.ndjson
├── messages.ndjson
└── knowledge_bases.ndjson
```

## V1 数据库 Schema（来源：better-sqlite3）

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,    -- Unix 时间戳（毫秒）
  updated_at INTEGER NOT NULL,    -- Unix 时间戳（毫秒）
  message_count INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,    -- Unix 时间戳（毫秒）
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE knowledge_bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  path TEXT NOT NULL,
  created_at INTEGER NOT NULL,    -- Unix 时间戳（毫秒）
  deleted_at INTEGER,             -- null = 未删除
  is_pinned INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  icon TEXT DEFAULT 'mdi-database'
);
```

## V1 → V2 字段映射

### sessions

| V1 字段 | V2 字段 | 转换逻辑 |
|---------|---------|----------|
| `id` | `id` | 直接映射（V1 使用 nanoid，与 V2 UUID 兼容） |
| — | `userId` | 使用 `--user-id` 参数值 |
| `title` | `title` | 直接映射，空则默认"导入的对话" |
| `provider` | `provider` | 直接映射 |
| `model` | `model` | 直接映射 |
| `created_at` | `createdAt` | Unix 毫秒时间戳 → ISO 8601（`new Date(ms).toISOString()`） |
| `updated_at` | `updatedAt` | 同上 |
| `message_count` | — | 忽略（V2 从 messages 表实时计数） |

### messages

| V1 字段 | V2 字段 | 转换逻辑 |
|---------|---------|----------|
| `id` | `id` | 直接映射 |
| `session_id` | `sessionId` | 直接映射 |
| `role` | `role` | 直接映射（user / assistant） |
| `content` | `content` | 直接映射 |
| `created_at` | `createdAt` | Unix 毫秒时间戳 → ISO 8601 |

### knowledge_bases

| V1 字段 | V2 字段 | 转换逻辑 |
|---------|---------|----------|
| `id` | `id` | 直接映射 |
| — | `userId` | 使用 `--user-id` 参数值 |
| `name` | `name` | 直接映射 |
| `is_pinned` | `isPinned` | 整数 0/1 → boolean |
| `sort_order` | `sortOrder` | 直接映射 |
| `icon` | `icon` | 直接映射 |
| `created_at` | `createdAt` | Unix 毫秒时间戳 → ISO 8601 |
| — | `updatedAt` | 使用 `createdAt` 值 |
| `path` | — | 忽略（V2 使用虚拟文件夹，非物理路径） |
| `deleted_at` | — | 忽略（仅导出未删除的知识库） |

## 依赖

- `better-sqlite3` — 读取 V1 SQLite 数据库（仅 CLI 工具依赖，不引入服务端运行时）
- Node.js `fs/path` — 文件写入

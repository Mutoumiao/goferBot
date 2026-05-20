---
issue_id: i-00-core-interfaces
type: behavior-spec
status: approved
summary: 定义所有接口的统一异步契约（Promise<T>）、IRepository 泛型约束、可选参数模式、IStorageProvider 流式下载约定及统一的错误处理模式（RepositoryError 系列）。
---
# Behavior Spec: i-00-core-interfaces

## 1. 接口调用约定

### 1.1 异步契约

- 所有接口方法必须返回 `Promise<T>`，禁止返回同步值。
- 调用方始终使用 `await` 或 `.then()` 消费结果。
- 理由：V1 中 `better-sqlite3` 的同步 API 导致业务代码与 SQLite 深度耦合，无法切换为 PostgreSQL / Drizzle 等异步驱动。

### 1.2 泛型约束

- `IRepository<T>` 的泛型参数 `T` 必须满足：
  - `id: string`（UUID 主键，统一使用 string 表示）
  - 可选：包含 `createdAt`、`updatedAt` 等审计字段
- 调用方在实例化时显式指定实体类型，例如 `IRepository<KnowledgeBase>`。

### 1.3 可选参数模式

- 查询类方法（`findAll`、`searchVectors`）使用可选对象参数：
  ```ts
  findAll(options?: { limit?: number; offset?: number; orderBy?: string })
  ```
- 理由：避免方法重载，保持 TypeScript 类型清晰，且易于扩展新过滤条件。

### 1.4 流式与缓冲

- `IStorageProvider.download` 返回 `ReadableStream`，而非一次性 `Buffer`。
- 理由：支持大文件流式传输，避免内存爆炸；V1 中文件直接读入内存，无法支撑大文档。

## 2. 错误处理模式

### 2.1 错误类型体系

所有接口抛出的错误必须是以下子类之一，调用方通过 `instanceof` 判断：

| 错误类 | 含义 | 典型场景 |
|--------|------|----------|
| `NotFoundError` | 资源不存在 | `findById` 传入无效 ID、`delete` 目标不存在 |
| `ConflictError` | 资源冲突 | `create` 时唯一键冲突（如邮箱已注册） |
| `ValidationError` | 参数非法 | 缺少必填字段、格式错误 |
| `StorageError` | 存储层失败 | MinIO 连接中断、 bucket 不存在 |
| `VectorStoreError` | 向量库失败 | Milvus 连接失败、维度不匹配 |
| `AuthError` | 认证失败 | 密码错误、Token 过期、未授权访问 |

### 2.2 错误传播原则

- 接口实现层捕获具体库异常（如 `pg` 的 `DatabaseError`、MinIO 的 `S3Error`），包装为上述标准错误后抛出。
- 禁止将底层库的原始异常直接抛给业务层。
- 错误消息使用简体中文或英文，必须包含可操作的信息（如 `"用户 ID 550e-... 不存在"`）。

### 2.3 幂等性

| 方法 | 幂等性 | 说明 |
|------|--------|------|
| `IRepository.create` | 否 | 重复调用会触发 `ConflictError` |
| `IRepository.update` | 是（部分） | 相同 payload 多次执行结果一致 |
| `IRepository.delete` | 是 | 删除不存在资源时静默成功或抛 `NotFoundError`（由实现决定，建议静默） |
| `IStorageProvider.delete` | 是 | 同上 |
| `IVectorStore.ensureCollection` | 是 | collection 已存在时直接返回 |
| `IAuthProvider.signOut` | 是 | 重复登出无副作用 |

## 3. 生命周期管理

### 3.1 初始化时序

```
应用启动
  └── IAuthProvider 初始化（加载会话密钥、配置）
  └── IRepository 初始化（数据库连接池就绪）
  └── IStorageProvider 初始化（MinIO Client / bucket 检查）
  └── IVectorStore 初始化（ensureCollection 创建/校验 collection）
```

- `ensureCollection` 必须在应用启动时调用一次，确保 Milvus collection 结构就绪。
- 各 Provider 的初始化函数返回 `Promise<void>`，启动脚本通过 `await` 串行或并行执行。

### 3.2 关闭时序

```
应用关闭（SIGTERM / 退出）
  └── IRepository 关闭连接池
  └── IVectorStore 关闭连接
  └── IStorageProvider 关闭（如有长连接）
  └── IAuthProvider 清理（如内存缓存）
```

- 各接口应暴露 `close?(): Promise<void>` 可选方法，供优雅关闭使用。

### 3.3 会话与上下文

- `IAuthProvider.getSession` 返回的会话对象必须包含 `userId`，供 `IRepository` 的多租户查询使用。
- 当前 MVP 为单用户，但接口设计预留 `userId` 字段，避免后续重构。

## 4. 使用示例

### 4.1 IRepository 使用示例

```ts
import type { IRepository } from '@/interfaces'

interface KnowledgeBase {
  id: string
  userId: string
  name: string
  isPinned: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

class KnowledgeBaseService {
  constructor(private repo: IRepository<KnowledgeBase>) {}

  async createDefault(userId: string) {
    return this.repo.create({
      userId,
      name: '默认知识库',
      isPinned: false,
      sortOrder: 0,
    })
  }

  async listPinned() {
    const all = await this.repo.findAll()
    return all.filter(kb => kb.isPinned)
  }
}
```

### 4.2 IStorageProvider 使用示例

```ts
import type { IStorageProvider } from '@/interfaces'

class DocumentService {
  constructor(private storage: IStorageProvider) {}

  async uploadDocument(userId: string, kbId: string, file: File) {
    const key = `users/${userId}/kb/${kbId}/${crypto.randomUUID()}_${file.name}`
    await this.storage.upload(key, file.stream(), file.type)
    return key
  }

  async getDownloadUrl(userId: string, storageKey: string) {
    // 校验 storageKey 是否属于该用户后返回 URL
    return this.storage.getUrl(storageKey, { expiresIn: 3600 })
  }
}
```

### 4.3 IVectorStore 使用示例

```ts
import type { IVectorStore } from '@/interfaces'

class RAGService {
  constructor(private vectorStore: IVectorStore) {}

  async indexChunks(kbId: string, chunks: Array<{ id: string; content: string; vector: number[] }>) {
    const vectors = chunks.map(c => ({
      id: c.id,
      kbId,
      fileId: c.id, // 简化示例
      embedding: c.vector,
    }))
    await this.vectorStore.insertVectors(vectors)
  }

  async retrieve(queryVector: number[], kbId: string, topK = 5) {
    return this.vectorStore.searchVectors(queryVector, { filter: { kbId }, topK })
  }
}
```

### 4.4 IAuthProvider 使用示例

```ts
import type { IAuthProvider } from '@/interfaces'
import { Hono } from 'hono'

function createApp(auth: IAuthProvider) {
  const app = new Hono()

  app.use('/api/*', auth.middleware())

  app.post('/api/auth/sign-up/email', async (c) => {
    const { email, password, name } = await c.req.json()
    const result = await auth.signUp({ email, password, name })
    return c.json(result)
  })

  app.get('/api/auth/session', async (c) => {
    const session = await auth.getSession(c.req.raw)
    return c.json(session)
  })

  return app
}
```

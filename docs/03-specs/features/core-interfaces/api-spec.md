# API Spec: i-00-core-interfaces

> 本文件定义的是 TypeScript 接口契约，非 HTTP API。

---

## 目录

1. [IRepository<T>](#irepositoryt)
2. [IStorageProvider](#istorageprovider)
3. [IVectorStore](#ivectorstore)
4. [IAuthProvider](#iauthprovider)
5. [共享类型](#共享类型)
6. [错误类型](#错误类型)

---

## IRepository<T>

泛型数据访问接口，覆盖所有 PostgreSQL 元数据表。

```typescript
export interface IRepository<T extends { id: string }> {
  /**
   * 根据主键查找单条记录。
   * @param id — 实体主键（UUID）
   * @returns 完整实体对象
   * @throws NotFoundError — 记录不存在时抛出
   */
  findById(id: string): Promise<T>

  /**
   * 分页/排序查询所有记录。
   * @param options — 可选分页与排序参数
   * @returns 实体数组（空数组表示无记录，不抛异常）
   */
  findAll(options?: RepositoryFindOptions): Promise<T[]>

  /**
   * 创建新记录。
   * @param data — 除 id 外的实体字段；id 由实现层生成（UUID v4）
   * @returns 创建后的完整实体（含生成的 id、createdAt、updatedAt）
   * @throws ConflictError — 唯一键冲突（如邮箱已存在）
   * @throws ValidationError — 必填字段缺失或格式非法
   */
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>

  /**
   * 根据主键更新记录。
   * @param id — 实体主键
   * @param data — 部分字段更新（不允许修改 id）
   * @returns 更新后的完整实体
   * @throws NotFoundError — 记录不存在时抛出
   */
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T>

  /**
   * 根据主键删除记录。
   * @param id — 实体主键
   * @returns void
   * @throws NotFoundError — 记录不存在时抛出（实现也可选择静默成功）
   */
  delete(id: string): Promise<void>
}

export interface RepositoryFindOptions {
  /** 返回记录数上限，默认 100 */
  limit?: number
  /** 跳过记录数，默认 0 */
  offset?: number
  /** 排序字段，格式为 "field:asc" 或 "field:desc" */
  orderBy?: string
}
```

### 与 PRD 数据模型的映射

| 实体类型 | 对应 Drizzle 表 | 说明 |
|----------|----------------|------|
| `User` | `users` | 认证系统核心表 |
| `KnowledgeBase` | `knowledge_bases` | 包含 `isPinned`、`sortOrder` |
| `Folder` | `folders` | 虚拟文件夹，支持 `parentId` 自引用 |
| `Document` | `documents` | 包含 `storageKey`、`status`、`errorMessage` |
| `Chunk` | `chunks` | 包含 `milvusId` 用于关联 Milvus |
| `Session` | `sessions` | 对话会话 |
| `Message` | `messages` | 消息，包含 `knowledgeBaseIds` 数组 |

---

## IStorageProvider

文件存储抽象，屏蔽本地文件系统与 MinIO 对象存储的差异。

```typescript
export interface IStorageProvider {
  /**
   * 上传文件流到存储后端。
   * @param key — 存储键，格式遵循 PRD: `users/<user-id>/kb/<kb-id>/<doc-id>_<filename>`
   * @param stream — 文件可读流
   * @param contentType — MIME 类型（如 "application/pdf"）
   * @returns 存储元数据（含 key、size、etag 等）
   * @throws StorageError — 上传失败（网络中断、bucket 不存在等）
   */
  upload(
    key: string,
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream,
    contentType: string
  ): Promise<StorageMeta>

  /**
   * 下载文件为可读流。
   * @param key — 存储键
   * @returns 文件可读流
   * @throws NotFoundError — 文件不存在时抛出
   * @throws StorageError — 存储层异常
   */
  download(key: string): Promise<ReadableStream<Uint8Array>>

  /**
   * 删除文件。
   * @param key — 存储键
   * @returns void
   * @throws NotFoundError — 文件不存在时抛出（实现也可选择静默成功）
   */
  delete(key: string): Promise<void>

  /**
   * 获取文件访问 URL。
   * @param key — 存储键
   * @param options — 可选配置（如预签名 URL 过期时间）
   * @returns 可直接访问的 URL 字符串
   * @throws NotFoundError — 文件不存在时抛出
   */
  getUrl(key: string, options?: StorageUrlOptions): Promise<string>
}

export interface StorageMeta {
  key: string
  size: number
  etag?: string
  contentType: string
  lastModified?: Date
}

export interface StorageUrlOptions {
  /** 预签名 URL 过期时间（秒），默认 3600 */
  expiresIn?: number
}
```

---

## IVectorStore

向量存储抽象，屏蔽 sqlite-vec（V1）与 Milvus（V2）的差异。

```typescript
export interface IVectorStore {
  /**
   * 批量插入向量记录。
   * @param vectors — 向量记录数组
   * @returns void
   * @throws VectorStoreError — 插入失败（如维度不匹配、连接中断）
   */
  insertVectors(vectors: VectorRecord[]): Promise<void>

  /**
   * ANN 近似最近邻搜索。
   * @param queryVector — 查询向量（维度必须与 collection 一致）
   * @param options — 搜索选项（过滤条件、返回数量）
   * @returns 搜索结果数组（按相似度降序）
   * @throws VectorStoreError — 搜索失败
   */
  searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]>

  /**
   * 根据 Milvus 主键删除向量。
   * @param ids — 要删除的向量 ID 数组
   * @returns void
   * @throws VectorStoreError — 删除失败
   */
  deleteByIds(ids: string[]): Promise<void>

  /**
   * 幂等地创建/校验 collection 结构。
   * 应用启动时调用一次，确保 collection 存在且字段类型正确。
   * @returns void
   * @throws VectorStoreError — 创建失败（如权限不足、维度参数非法）
   */
  ensureCollection(): Promise<void>
}

export interface VectorRecord {
  /** Milvus 主键（VARCHAR） */
  id: string
  /** 关联 PostgreSQL chunks.id */
  chunkId: string
  /** 知识库 ID，用于过滤 */
  kbId: string
  /** 文档 ID */
  fileId: string
  /** 向量数据，维度 1536（默认） */
  embedding: number[]
}

export interface VectorSearchOptions {
  /** 返回结果数量，默认 5 */
  topK?: number
  /** 过滤条件，当前仅支持 kbId 精确匹配（MVP） */
  filter?: {
    kbId?: string
  }
}

export interface VectorSearchResult {
  /** Milvus 主键 */
  id: string
  /** 关联 chunkId */
  chunkId: string
  /** 相似度分数（0~1，越高越相似） */
  score: number
}
```

### Collection 结构映射（PRD 7.3）

| Milvus 字段 | 接口属性 | 类型 |
|-------------|----------|------|
| `id` | `VectorRecord.id` | VARCHAR (PK) |
| `chunk_id` | `VectorRecord.chunkId` | VARCHAR |
| `kb_id` | `VectorRecord.kbId` | VARCHAR |
| `file_id` | `VectorRecord.fileId` | VARCHAR |
| `embedding` | `VectorRecord.embedding` | FLOAT_VECTOR(1536) |

---

## IAuthProvider

认证抽象，支持邮箱密码登录、会话管理与 Hono 中间件集成。

```typescript
import type { MiddlewareHandler } from 'hono'

export interface IAuthProvider {
  /**
   * 用户注册。
   * @param credentials — 注册信息
   * @returns 创建的用户对象（不含密码）与初始会话
   * @throws ConflictError — 邮箱已注册
   * @throws ValidationError — 密码强度不足或格式非法
   */
  signUp(credentials: SignUpCredentials): Promise<AuthResult>

  /**
   * 用户登录。
   * @param credentials — 登录信息
   * @returns 用户对象与新会话
   * @throws AuthError — 邮箱或密码错误
   */
  signIn(credentials: SignInCredentials): Promise<AuthResult>

  /**
   * 用户登出，销毁当前会话。
   * @param request — 当前 HTTP 请求（用于读取 Cookie/Token）
   * @returns void
   */
  signOut(request: Request): Promise<void>

  /**
   * 获取当前会话信息。
   * @param request — 当前 HTTP 请求
   * @returns 会话对象；未登录时返回 null（不抛异常）
   */
  getSession(request: Request): Promise<Session | null>

  /**
   * 返回 Hono 中间件，用于保护路由。
   * 中间件内部调用 getSession，未登录时返回 401。
   * @returns Hono MiddlewareHandler
   */
  middleware(): MiddlewareHandler
}

export interface SignUpCredentials {
  email: string
  password: string
  name?: string
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface AuthResult {
  user: User
  session: Session
}

export interface User {
  id: string
  email: string
  name: string | null
  avatar: string | null
  createdAt: Date
}

export interface Session {
  id: string
  userId: string
  expiresAt: Date
}
```

---

## 共享类型

以下类型供多个接口共享，建议放在 `packages/server/src/interfaces/types.ts`：

```typescript
/** 所有实体基类型，约束 id 字段 */
export interface EntityBase {
  id: string
  createdAt?: Date
  updatedAt?: Date
}
```

---

## 错误类型

所有接口共享的错误类定义，建议放在 `packages/server/src/interfaces/errors.ts`：

```typescript
export class RepositoryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'RepositoryError'
  }
}

export class NotFoundError extends RepositoryError {
  constructor(resource: string, id: string) {
    super(`${resource} ID ${id} 不存在`)
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class StorageError extends RepositoryError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'StorageError'
  }
}

export class VectorStoreError extends RepositoryError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'VectorStoreError'
  }
}

export class AuthError extends RepositoryError {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
```

---

## 统一导出

`packages/server/src/interfaces/index.ts`：

```typescript
export * from './IRepository'
export * from './IStorageProvider'
export * from './IVectorStore'
export * from './IAuthProvider'
export * from './types'
export * from './errors'
```

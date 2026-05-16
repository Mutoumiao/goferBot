# API Spec: Milvus Service（NestJS 封装）

> Issue: i-12-milvus-service
> 状态: 草案
> 日期: 2026-05-16

---

## 说明

本 feature 为**基础设施层内部 NestJS Service**，不直接暴露任何 REST API 端点。业务模块通过 NestJS 依赖注入使用 `VectorService`。

本文档定义内部 TypeScript 接口契约、Module 注册方式与调用约定。

---

## 1. Module 定义

### 1.1 VectorModule

实现文件: `packages/server/src/processors/vector/vector.module.ts`

```typescript
import { Global, Module } from '@nestjs/common'
import { VectorService } from './vector.service.js'

@Global()
@Module({
  providers: [VectorService],
  exports: [VectorService],
})
export class VectorModule {}
```

| 项 | 值 |
|---|---|
| 装饰器 | `@Global()` + `@Module()` |
| Providers | `VectorService` |
| Exports | `VectorService` |
| 导入方 | `AppModule`（根模块） |

---

## 2. Service 定义

### 2.1 VectorService

实现文件: `packages/server/src/processors/vector/vector.service.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '../../interfaces/IVectorStore.js'
import { MilvusVectorStore } from '../../vector/milvus.js'

@Injectable()
export class VectorService implements IVectorStore, OnModuleInit {
  private readonly store: MilvusVectorStore

  constructor(private readonly config: ConfigService) {
    this.store = new MilvusVectorStore({
      host: this.config.get<string>('MILVUS_HOST'),
      port: this.config.get<string>('MILVUS_PORT'),
      collectionName: this.config.get<string>('MILVUS_COLLECTION'),
      vectorDim: this.config.get<number>('MILVUS_VECTOR_DIM'),
    })
  }

  async onModuleInit(): Promise<void> {
    await this.store.checkHealth()
    await this.store.ensureCollection()
  }

  async ensureCollection(): Promise<void> {
    return this.store.ensureCollection()
  }

  async insertVectors(vectors: VectorRecord[]): Promise<void> {
    return this.store.insertVectors(vectors)
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions
  ): Promise<VectorSearchResult[]> {
    return this.store.searchVectors(queryVector, options)
  }

  async deleteByIds(ids: string[]): Promise<void> {
    return this.store.deleteByIds(ids)
  }

  async deleteByFileId(fileId: string): Promise<void> {
    return this.store.deleteByFileId(fileId)
  }

  async deleteByKbId(kbId: string): Promise<void> {
    return this.store.deleteByKbId(kbId)
  }
}
```

---

## 3. 方法详情

### 3.1 ensureCollection()

| 项 | 值 |
|---|---|
| 可见性 | public |
| 幂等性 | 是 |
| 副作用 | 可能创建 Collection、创建索引、加载 Collection |
| 错误 | `VectorStoreError`（连接失败、权限不足、维度非法） |
| 说明 | 委托 `MilvusVectorStore.ensureCollection()` |

---

### 3.2 insertVectors(vectors)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `vectors: VectorRecord[]` |
| 返回 | `Promise<void>` |
| 校验 | 数组非空、每条 embedding 长度等于 vectorDim |
| 错误 | `VectorStoreError`（维度不匹配、插入失败） |
| 说明 | 委托 `MilvusVectorStore.insertVectors(vectors)` |

---

### 3.3 searchVectors(queryVector, options)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `queryVector: number[]`, `options?: VectorSearchOptions` |
| 返回 | `Promise<VectorSearchResult[]>` |
| 校验 | queryVector 长度等于 vectorDim |
| 过滤 | 支持 `kbId` 精确匹配（生成 `kb_id == "..."` 表达式） |
| 错误 | `VectorStoreError`（搜索失败、超时） |
| 说明 | 委托 `MilvusVectorStore.searchVectors(queryVector, options)` |

---

### 3.4 deleteByIds(ids)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `ids: string[]` — Milvus 主键数组 |
| 返回 | `Promise<void>` |
| 校验 | 数组非空 |
| 错误 | `VectorStoreError`（删除失败） |
| 说明 | 委托 `MilvusVectorStore.deleteByIds(ids)` |

---

### 3.5 deleteByFileId(fileId)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `fileId: string` — 文档 ID |
| 返回 | `Promise<void>` |
| 表达式 | `file_id == "{fileId}"` |
| 用途 | 文档删除或重新索引时批量清理向量 |
| 说明 | 委托 `MilvusVectorStore.deleteByFileId(fileId)`，不在 `IVectorStore` 接口中 |

---

### 3.6 deleteByKbId(kbId)

| 项 | 值 |
|---|---|
| 可见性 | public |
| 参数 | `kbId: string` — 知识库 ID |
| 返回 | `Promise<void>` |
| 表达式 | `kb_id == "{kbId}"` |
| 用途 | 删除知识库时清理全部关联向量 |
| 说明 | 委托 `MilvusVectorStore.deleteByKbId(kbId)`，不在 `IVectorStore` 接口中 |

---

## 4. 生命周期

```
AppModule 导入 VectorModule
    ↓
NestJS 实例化 VectorService
    ↓
ConfigService 注入 → 读取 MILVUS_HOST / MILVUS_PORT / MILVUS_COLLECTION / MILVUS_VECTOR_DIM
    ↓
构造函数创建 MilvusVectorStore 实例
    ↓
onModuleInit():
    - checkHealth()   # 5 秒内检查连接
    - ensureCollection()  # 幂等创建/校验 Collection
    ↓
Service 就绪，可被任何模块注入使用
```

---

## 5. 配置项

通过 `ConfigService` 读取，来源为 `.env` 文件或运行时环境变量。

| 配置键 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| `MILVUS_HOST` | `MILVUS_HOST` | `localhost` | Milvus 服务地址 |
| `MILVUS_PORT` | `MILVUS_PORT` | `19530` | Milvus gRPC 端口 |
| `MILVUS_COLLECTION` | `MILVUS_COLLECTION` | `knowledge_chunks` | Collection 名称 |
| `MILVUS_VECTOR_DIM` | `MILVUS_VECTOR_DIM` | `1536` | 向量维度 |

---

## 6. 调用约定

### 6.1 在业务模块中注入使用

```typescript
import { Injectable } from '@nestjs/common'
import { VectorService } from '../processors/vector/vector.service.js'
import type { VectorRecord } from '../interfaces/IVectorStore.js'

@Injectable()
export class DocumentService {
  constructor(private readonly vectorService: VectorService) {}

  async reindexDocument(fileId: string, vectors: VectorRecord[]): Promise<void> {
    await this.vectorService.deleteByFileId(fileId)
    await this.vectorService.insertVectors(vectors)
  }
}
```

### 6.2 在 RAG SDK 中通过接口使用

```typescript
import { Injectable } from '@nestjs/common'
import type { IVectorStore } from '../interfaces/IVectorStore.js'

@Injectable()
export class Retriever {
  constructor(private readonly vectorStore: IVectorStore) {}

  async retrieve(queryVector: number[], kbId: string) {
    return this.vectorStore.searchVectors(queryVector, { filter: { kbId }, topK: 5 })
  }
}
```

---

## 7. 类型对照表

| TypeScript 类型 | Milvus DataType |
|-----------------|-----------------|
| `string` (id, chunk_id, kb_id, file_id) | `DataType.VarChar` |
| `number[]` (embedding) | `DataType.FloatVector` |

---

## 8. 无 REST API

本 Service 不注册任何 HTTP 路由。健康检查复用全局 `GET /health`，由 `HealthModule` / `Terminus` 在后续扩展中集成 Milvus 健康探针。

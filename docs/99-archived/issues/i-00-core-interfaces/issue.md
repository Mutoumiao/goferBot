---
id: i-00-core-interfaces
type: issue
status: closed
track: infra
priority: p0
summary: 在 Phase 1 编码前定义核心接口抽象层（IRepository/IStorageProvider/IVectorStore/IAuthProvider），避免 V1 中数据访问紧耦合的问题在 V2 重演。
blocked_by: []
blocks: []
spec: docs/03-specs/i-00-core-interfaces/
plan: docs/04-plans/i-00-core-interfaces/v1.md
tests: docs/08-test-cases/i-00-core-interfaces/
token_estimate: 900
---

状态: closed
分类: enhancement

## 要构建的内容

在 Phase 1 编码前，定义核心接口抽象层。避免 V1 中"数据访问紧耦合 better-sqlite3"的问题在 V2 重演。

## 规格引用

- PRD: docs/01-prd/v2-cloud-native.md
- ADR: docs/05-adrs/0004-cloud-native-rearchitecture.md

## 验收标准

- [x] `packages/server/src/interfaces/IRepository.ts` — 泛型数据访问接口（findById / findAll / create / update / delete）
- [x] `packages/server/src/interfaces/IStorageProvider.ts` — 文件存储接口（upload / download / delete / getUrl）
- [x] `packages/server/src/interfaces/IVectorStore.ts` — 向量存储接口（insertVectors / searchVectors / deleteByIds / ensureCollection）
- [x] `packages/server/src/interfaces/IAuthProvider.ts` — 认证接口（signIn / signUp / signOut / getSession / middleware）
- [x] `packages/server/src/interfaces/index.ts` — 统一导出
- [x] 所有接口方法签名与 PRD 数据模型一致
- [x] V1 SQLite 实现和 V2 PG/MinIO/Milvus 实现必须实现相同接口

## 阻塞于

- 无（最优先任务）

## 范围外

- 接口的具体实现（由 i-02~i-04 负责）
- 性能优化

## Agent 简报

**分类：** enhancement
**摘要：** 定义核心接口抽象层（IRepository / IStorageProvider / IVectorStore / IAuthProvider），确保 V1→V2 迁移不重蹈紧耦合覆辙

**当前行为：**
所有路由直接使用 better-sqlite3 同步 API，无 Repository 抽象层。

**期望行为：**
接口定义完成，后续 Phase 1-5 的所有实现依赖接口而非具体数据库/存储。

**关键接口：**
- `packages/server/src/interfaces/IRepository.ts`
- `packages/server/src/interfaces/IStorageProvider.ts`
- `packages/server/src/interfaces/IVectorStore.ts`
- `packages/server/src/interfaces/IAuthProvider.ts`

**验收标准：**
- [ ] 四个核心接口定义完成
- [ ] 所有方法签名与 PRD 数据模型一致
- [ ] 统一导出

**范围外：**
- 接口的具体实现
- 性能优化

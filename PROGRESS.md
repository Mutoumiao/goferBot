# 项目进度追踪（Progress）

> **更新日期**：2026-05-15
> **当前阶段**：云原生架构重构（V2）

---

## ⚠️ 重要声明

项目已从 V1 架构（Tauri + SQLite + 本地文件系统）全面重构为 V2 云原生架构。

旧 Issue（#01~#13）、旧计划文件、旧 ADR（0001~0003, 0005~0006）已全部归档至 `docs/archived/`，**不再适用当前开发**。

当前开发必须参考：
- `docs/superpowers/specs/2026-05-15-cloud-native-rearchitecture.md`
- `docs/adr/0004-cloud-native-rearchitecture.md`
- `docs/interview-architecture-evolution.md`

---

## V2 架构概览

| 层级 | 技术 | 职责 |
|------|------|------|
| 对象存储 | MinIO (Docker) | 文件内容存储 |
| 主数据库 | PostgreSQL (Docker) + Drizzle ORM | 元数据、用户、认证 |
| 向量数据库 | Milvus (Docker) | 向量索引与 ANN 搜索 |
| 缓存/队列 | Redis (Docker) + BullMQ | 异步任务流水线 |
| 认证 | Better Auth | 会话与账号管理 |
| 本地缓存 | SQLite | UI 状态、离线缓存、Agent Memory |

---

## 实施阶段

### Phase 1: 基础设施（P0）

- [ ] Docker Compose 配置（PG + MinIO + Milvus + Redis）
- [ ] Drizzle ORM 配置 + 数据库迁移
- [ ] MinIO Client 封装
- [ ] Milvus Client 封装
- [ ] Redis + BullMQ 配置

### Phase 2: 认证系统（P0）

- [ ] Better Auth 集成
- [ ] 登录/注册 API
- [ ] 前端登录/注册页面
- [ ] 路由守卫（未登录跳转）

### Phase 3: 知识库与文件（P0）

- [ ] 知识库 CRUD（PostgreSQL）
- [ ] 虚拟文件夹 CRUD
- [ ] 文件上传 → MinIO
- [ ] 文件列表/删除/移动
- [ ] 文档状态机（status 字段）
- [ ] 异步流水线框架（BullMQ + Worker 占位）

### Phase 4: 聊天功能（P0）

- [ ] 会话 CRUD（PostgreSQL）
- [ ] 消息存储
- [ ] SSE 流式对话
- [ ] 多知识库选择 UI
- [ ] RAG 预留接口（先返回空）

### Phase 5: RAG 集成（P1）

- [ ] SDK 实现：解析 → 分块 → 向量化
- [ ] Milvus 写入与检索
- [ ] 混合检索（向量 + 关键词）
- [ ] Rerank

### Phase 6: 优化（P2）

- [ ] Presigned URL 上传
- [ ] 文件预览（PDF/图片/Markdown）
- [ ] 本地 SQLite 缓存层
- [ ] 离线模式支持

---

*最后更新：2026-05-15（云原生架构重构启动）*

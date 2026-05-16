# 项目进度追踪（Progress）

> **更新日期**：2026-05-16
> **当前阶段**：云原生架构重构（V2）— Phase 1 基础设施编码中

---

## 重要声明

项目已从 V1 架构（Tauri + SQLite + 本地文件系统）全面重构为 V2 云原生架构。

当前开发必须参考：
- `docs/01-prd/v2-cloud-native.md`
- `docs/05-adrs/0004-cloud-native-rearchitecture.md`
- `docs/00-meta/workflow.md`

---

## V2 架构概览

| 层级 | 技术 | 职责 |
|------|------|------|
| 前端 | Vue 3 + vue-router + Pinia | Web UI |
| 后端 | Hono (Node.js) | API Server |
| 对象存储 | MinIO (Docker) | 文件内容存储 |
| 主数据库 | PostgreSQL (Docker) + Drizzle ORM | 元数据、用户、认证 |
| 向量数据库 | Milvus (Docker) | 向量索引与 ANN 搜索 |
| 缓存/队列 | Redis (Docker) + BullMQ | 异步任务流水线 |
| 认证 | Better Auth | 会话与账号管理 |

---

## 架构改革完成情况（2026-05-16）

### 已完成

- [x] `src-tauri/` 冻结并文档化（`src-tauri/README.md`）
- [x] 删除 `packages/shellAdapters/` 和 `packages/backendAdapters/`
- [x] 前端改用直接 HTTP 通信（`api/client.ts`）
- [x] 引入 `vue-router`，`App.vue` 改用 `<RouterView />`
- [x] 删除 `useSidecarStatus`、`SplashScreen` 等 Sidecar 相关代码
- [x] Server 去 Sidecar 化（固定端口、删除 `.sidecar-port`、简化 CORS）
- [x] 重写所有 stores（session/knowledgeBase/settings）移除 adapter 依赖

### 改革中新增 Issue

| Issue | 说明 |
|-------|------|
| `i-07-api-client` | 标准化前端 API 客户端（当前临时实现需升级） |
| `q-03-v1-cleanup` | 清理 V1 废弃代码（SQLite、sync、better-sqlite3 依赖） |
| `f-14-adapter-removal` | 记录 adapter 移除过程（已关闭） |

### 改革中更新 Issue

| Issue | 更新内容 |
|-------|----------|
| `i-01-docker-compose-infra` | 删除 Sidecar `port: 0` 条目 |
| `q-02-auth-hardening` | **归档作废**（原 Sidecar Token 机制不再适用） |
| `f-03-sidebar-navigation` | 标记部分完成，更新阻塞关系 |
| `f-04-tab-bar` | 调整为 Chat 页面内部组件（非全局导航） |

---

## 实施阶段

### Phase 0: 架构改革（已完成）

- [x] Tauri 冻结文档化
- [x] Adapter 包移除
- [x] vue-router 引入
- [x] Server 去 Sidecar 化
- [x] V1 代码清理（q-03 已完成）

### Phase 1: 基础设施（P0）— 进行中

| Issue | 状态 | Spec | Plan | 代码 | 说明 |
|-------|------|------|------|------|------|
| `i-00-core-interfaces` | ✅ | ✅ | ✅ | ✅ | 7 个接口文件，type-check 通过 |
| `i-01-docker-compose-infra` | ✅ | ✅ | ✅ | ✅ | docker-compose.dev.yml、.env.example、infra 脚本 |
| `q-03-v1-cleanup` | ✅ | ✅ | ✅ | ✅ | V1 代码清理，依赖移除，路由 501 |
| `i-02-drizzle-orm-setup` | ✅ | ✅ | ⬜ | ⬜ | Spec 完成，待生成 Plan |
| `i-07-api-client` | ✅ | ✅ | ⬜ | ⬜ | Spec 完成，待生成 Plan |
| `i-03-minio-client` | ⬜ | ⬜ | ⬜ | ⬜ | 待生成 Spec |
| `i-04-milvus-client` | ⬜ | ⬜ | ⬜ | ⬜ | 待生成 Spec |
| `i-05-redis-bullmq-setup` | ⬜ | ⬜ | ⬜ | ⬜ | 待生成 Spec |

### Phase 2: 认证系统（P0）

| Issue | 状态 | Spec | Plan | 代码 | 说明 |
|-------|------|------|------|------|------|
| `b-01-auth-api` | ✅ | ✅ | ⬜ | ⬜ | Spec 完成，待生成 Plan |
| `f-01-auth-pages` | ⬜ | ⬜ | ⬜ | ⬜ | 待生成 Spec |
| `f-02-route-guard` | ⬜ | ⬜ | ⬜ | ⬜ | 待生成 Spec |
| `q-01-security-baseline` | ⬜ | ⬜ | ⬜ | ⬜ | 待生成 Spec |

### Phase 3: 知识库与文件（P0）

- [ ] `b-02-knowledge-base-crud-api` — 知识库 CRUD（PostgreSQL）
- [ ] `f-03-sidebar-navigation` — 侧边栏导航（部分完成）
- [ ] `f-05-knowledge-base-list` — 知识库列表页
- [ ] `f-06-knowledge-base-file-manager` — 文件管理器
- [ ] `f-07-file-upload-component` — 文件上传组件
- [ ] `f-08-folder-management` — 虚拟文件夹管理

### Phase 4: 聊天功能（P0）

- [ ] `b-03-session-api` — 会话 CRUD
- [ ] `b-04-chat-sse-api` — SSE 流式对话
- [ ] `b-05-settings-api` — 设置 API
- [ ] `f-04-tab-bar` — Chat 页面内标签栏
- [ ] `f-09-chat-page` — 问答对话页
- [ ] `f-10-message-renderer` — 消息渲染组件
- [ ] `f-11-kb-selector` — 多知识库选择
- [ ] `f-12-chat-history` — 对话历史页
- [ ] `f-13-settings-page` — 设置页

### Phase 5: RAG 集成（P1）

- [ ] `d-01-rag-sdk-contracts` — RAG SDK 接口合约
- [ ] SDK 实现：解析 → 分块 → 向量化
- [ ] Milvus 写入与检索
- [ ] 混合检索（向量 + 关键词）
- [ ] Rerank

### Phase 6: 优化与扩展（P2）

- [ ] `i-06-data-migration` — V1→V2 数据导出工具
- [ ] Presigned URL 上传
- [ ] 文件预览（PDF/图片/Markdown）
- [ ] Tauri 解冻（本地增强功能）
- [ ] 离线模式支持

---

*最后更新：2026-05-16（Phase 1 基础设施编码中）*

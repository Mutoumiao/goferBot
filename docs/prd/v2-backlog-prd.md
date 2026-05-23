# GoferBot v2 待处理问题 PRD

> 版本：v2.1-backlog
> 日期：2026-05-23
> 来源：issue 01-08 综合审查（kb-review）

---

## 1. 后端 API 缺失端点

### 1.1 文档详情端点

**端点**：`GET /api/knowledge-bases/:kbId/documents/:docId`

**需求**：
- 返回单个文档的完整元数据（id、name、ext、mimeType、size、status、storageKey、createdAt、updatedAt）
- 需验证用户是知识库所有者
- 需验证文档属于该知识库

**错误码**：
| 码 | 场景 |
|----|------|
| 401 | 未认证 |
| 403 | 非知识库所有者 |
| 404 | 知识库不存在或文档不存在 |

**优先级**：p2
**建议 Issue 编号**：b-11

---

### 1.2 文档下载端点

**端点**：`GET /api/knowledge-bases/:kbId/documents/:docId/download`

**需求**：
- 从 MinIO 获取文件流并返回给客户端
- 设置 `Content-Disposition: attachment` 响应头
- 支持大文件流式传输（不加载到内存）

**错误码**：
| 码 | 场景 |
|----|------|
| 401 | 未认证 |
| 403 | 非知识库所有者 |
| 404 | 文档不存在 |
| 500 | MinIO 读取失败 |

**优先级**：p2
**建议 Issue 编号**：b-11（与文档详情合并）

---

### 1.3 文档预览端点

**端点**：`GET /api/knowledge-bases/:kbId/documents/:docId/preview`

**需求**：
- 对文本文件（md/txt）直接返回内容
- 对 PDF 返回流式响应（浏览器可直接渲染）
- 设置正确的 `Content-Type`

**错误码**：
| 码 | 场景 |
|----|------|
| 401 | 未认证 |
| 403 | 非知识库所有者 |
| 404 | 文档不存在 |
| 415 | 文件类型不支持预览 |

**优先级**：p2
**建议 Issue 编号**：b-11（与文档详情合并）

---

## 2. 安全增强

### 2.1 JWT 令牌黑名单机制

**问题**：当前 logout 端点仅返回 `{ success: true }`，令牌在服务端无失效机制。被盗令牌在过期前始终有效。

**解决方案**：
1. 引入 Redis 存储令牌黑名单（jti 或 token hash）
2. logout 时将当前 accessToken 加入黑名单
3. JwtAuthGuard 验证时检查黑名单
4. refresh 时若 refreshToken 在黑名单中则拒绝

**影响范围**：
- `packages/server/src/auth/auth.controller.ts` — logout 逻辑
- `packages/server/src/auth/guards/jwt.guard.ts` — 验证逻辑
- `packages/server/src/auth/auth.service.ts` — refresh 逻辑
- 新增 `packages/server/src/auth/services/token-blacklist.service.ts`

**优先级**：p2
**建议 Issue 编号**：q-02

---

### 2.2 文件上传 Magic Bytes 校验

**问题**：DocumentController 上传校验仅依赖 `filename` 后缀和 `mimetype`，两者均可被客户端伪造。

**解决方案**：
1. 对二进制文件（PDF）读取文件头 magic bytes 确认真实类型
2. PDF 文件头应为 `%PDF-1.x`
3. 对文本文件（md/txt）进行内容编码检测（UTF-8）

**影响范围**：
- `packages/server/src/modules/knowledge-base/document.controller.ts` — upload 方法

**优先级**：p3
**建议 Issue 编号**：q-03

---

## 3. 前端优化

### 3.1 对话历史页 Tab 切换

**问题**：PRD 要求对话历史页有 Tabs（默认"问答历史"），当前实现为单一直接列表。

**备注**：如后续增加"Agent 历史"或其他历史类型，再补充 Tab 切换。当前单列表满足 MVP 需求。

**优先级**：p3
**建议 Issue 编号**：f-11

---

## 4. 预留功能

### 4.1 文档重新索引

**端点**：`POST /api/knowledge-bases/:kbId/documents/:docId/reindex`

**需求**：
- 重新触发文档的 parse → chunk → embed → Milvus 流程
- 需接入 BullMQ 任务队列

**优先级**：p3（依赖 RAG SDK 解冻）
**建议 Issue 编号**：b-12

---

### 4.2 索引状态查询

**端点**：`GET /api/knowledge-bases/:kbId/index-status`

**需求**：
- 返回知识库内所有文档的索引状态统计
- 用于前端展示知识库整体索引进度

**优先级**：p3（依赖 RAG SDK 解冻）
**建议 Issue 编号**：b-12（与重新索引合并）

---

## 5. 优先级汇总

| 问题 | 优先级 | 建议 Issue | 预估工作量 |
|------|--------|-----------|-----------|
| 文档详情/下载/预览端点 | p2 | b-11 | 1-2 天 |
| JWT 令牌黑名单 | p2 | q-02 | 1-2 天 |
| 文件 Magic Bytes 校验 | p3 | q-03 | 0.5 天 |
| 对话历史页 Tab 切换 | p3 | f-11 | 0.5 天 |
| 文档重新索引 + 状态查询 | p3 | b-12 | 2-3 天 |

---

## 6. 关联文档

- [v2-cloud-native.md](./v2-cloud-native.md) — 主 PRD
- [api-testing-prd.md](./api-testing-prd.md) — API 测试需求
- [overlay-refactor-prd.md](./overlay-refactor-prd.md) — Overlay 重构需求

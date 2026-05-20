---
id: f-12-chat-history
type: issue
status: closed
track: frontend
priority: p0
summary: 实现对话历史页，支持查看、恢复、删除、重命名历史会话。用户可查看历史对话列表，点击恢复继续对话，支持搜索过滤。
blocked_by: [b-03-session-api, f-03-sidebar-navigation]
blocks: []
spec: docs/03-specs/f-12-chat-history/
plan: docs/04-plans/f-12-chat-history/v1.md
tests: docs/08-test-cases/f-12-chat-history/
token_estimate: 1000
---

状态: closed
分类: enhancement

## 要构建的内容

实现对话历史页，支持查看、恢复、删除、重命名历史会话。

## 规格引用

- 功能规格: docs/03-specs/f-12-chat-history/feature-spec.md
- 行为规格: docs/03-specs/f-12-chat-history/behavior-spec.md
- API 规格: docs/03-specs/b-03-session-api/api-spec.md

## 验收标准

- [ ] `packages/webui/src/views/HistoryView.vue` 实现对话历史页
- [ ] 列表项显示：对话总结标题、最后消息时间、少许内容摘要
- [ ] 点击列表项恢复续上对话（打开对应会话标签）
- [ ] 支持删除会话（确认对话框）
- [ ] 支持重命名会话（内联编辑或对话框）
- [ ] 列表按最后消息时间倒序排列
- [ ] 空状态：提示"暂无对话历史"
- [ ] 加载状态：骨架屏
- [ ] 错误状态：加载失败 + 重试按钮
- [ ] 支持搜索过滤（按标题或内容摘要）
- [ ] 使用 Pinia Store 管理历史列表状态

## 阻塞于

- b-03-session-api（需要会话 API）
- f-03-sidebar-navigation（需要从边栏进入历史页）

## 范围外

- 对话导出（PDF/Markdown）
- 对话分享
- 批量删除

## Agent 简报

**分类：** enhancement
**摘要：** 对话历史页，查看、恢复、删除、重命名历史会话

**当前行为：**
前端无对话历史界面。

**期望行为：**
用户可查看历史对话列表，点击恢复继续对话，支持删除和重命名。

**关键接口：**
- `packages/webui/src/views/HistoryView.vue` — 历史页
- API: `GET/DELETE/POST /api/sessions/*`
- Pinia Store — 历史列表状态

**验收标准：**
- [ ] 历史页实现
- [ ] 列表显示标题、时间、摘要
- [ ] 点击恢复对话
- [ ] 删除会话（确认对话框）
- [ ] 重命名会话
- [ ] 按时间倒序
- [ ] 空状态提示
- [ ] 加载骨架屏
- [ ] 错误状态 + 重试
- [ ] 搜索过滤
- [ ] Pinia Store 管理状态

**范围外：**
- 对话导出
- 对话分享
- 批量删除

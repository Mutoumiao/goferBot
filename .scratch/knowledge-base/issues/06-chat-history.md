Status: needs-triage

## What to build

实现对话历史页面，用户可以查看所有历史会话列表，点击恢复续上对话，支持删除和重命名。

端到端行为：用户点击左侧时钟图标 → 打开对话历史页（单例标签）→ 显示 Tabs（默认"问答历史"）→ 列表展示所有历史会话（时间、总结标题、内容摘要）→ 用户点击某个历史项 → 如果该 session 未在标签中打开，则优先复用当前空的首页占位符（替换其内容），否则新建标签加载该 session → 如果该 session 已在某标签打开，则直接激活那个标签 → 用户可以删除历史（删除 SQLite 记录和关联消息，关闭对应标签）→ 用户可以重命名会话（修改 `sessions.title`）。

## Acceptance criteria

- [ ] 前端对话历史页：Tabs + 历史列表
- [ ] 列表项：总结标题、最后消息时间、内容摘要（前 100 字）
- [ ] Sidecar API：`GET /sessions`（列表，含时间、标题、摘要）、`POST /sessions/:id/rename`、`DELETE /sessions/:id`
- [ ] 点击恢复：未打开则复用首页占位符或新建标签；已打开则激活已有标签（1:1 关系）
- [ ] 删除历史：删除 SQLite `sessions` 和关联 `messages`，若该 session 有打开的标签则关闭
- [ ] 重命名：修改 `sessions.title`，对应标签标题同步更新
- [ ] 空状态：无历史时显示引导提示

## Blocked by

- [02-basic-chat](../02-basic-chat.md) — 必须先有基础对话和会话管理

## Comments

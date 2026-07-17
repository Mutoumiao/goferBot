# Companion UI 渲染开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md)（WHAT）。Memory 5 种类型 / CompanionForm 字段定义 / 组件树业务约束 / SSE 流式契约 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 Companion 前端 UI 渲染模块中高效工作：理解打字机动画、流式渲染、双模式表单等实现模式，避免重复踩坑。业务字段定义、组件树业务约束请直接查阅 OpenSpec。

## Primary OpenSpec

- [openspec/specs/companion/spec.md](../../../../openspec/specs/companion/spec.md) — Companion 业务规范（前端范围、SSE/Transport、反馈、记忆管理）

## Related OpenSpec

- [openspec/specs/companion-persona/spec.md](../../../../openspec/specs/companion-persona/spec.md) — 人设表单 / 头像 / 开场白
- [openspec/specs/companion-care/spec.md](../../../../openspec/specs/companion-care/spec.md) — 关怀配置与「关怀」标记
- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — Knowledge Chat SSE（**勿**与 Companion Transport 混用）
- [openspec/changes/web-l1-cache-l2-dialogs](../../../../openspec/changes/web-l1-cache-l2-dialogs/) — 一级 path 缓存 + 二级弹层（实现中 / 归档后见主库 `web-shell`）

## Module Dependencies

- **Zustand** — `useCompanionStore`（含 `selectedCompanionId` 页内选中，不写 URL）
- **AI SDK (`@ai-sdk/react` useChat) + `CompanionChatTransport`** — Companion 主聊天路径；映射 Nest SSE（token/done/error/summary/memories）
- **alova** — Companion CRUD / 记忆 / 关怀 REST
- **Overlay `openDialog`** — 新建 / 编辑 / 关怀 / 记忆库二级入口
- **shadcn/ui** — 表单与布局组件
- **Knowledge Chat 仍可用 ant-design/x** — Companion **主路径已不再依赖** Bubble/Sender

## Development Entry

- `packages/web/src/features/companion/` — Companion 全部前端文件
- `packages/web/src/features/companion/components/CompanionsWorkspace.tsx` — **一级** `/companions` 工作台（左联系人 + 右内嵌聊天）
- `packages/web/src/features/companion/components/CompanionChatPage.tsx` — 内嵌对话（`embedded`）
- `packages/web/src/features/companion/components/` — Form / Care / Memories 内容组件（供弹层承载，非独立路由页）
- `packages/web/src/features/companion/dialogs/` 或 `open-*.ts` — `openCompanionCreate|Edit|Care|MemoriesDialog`（实现落点）
- `packages/web/src/features/companion/companion-chat-transport.ts` — SSE → AI SDK Transport
- `packages/web/src/features/companion/types.ts` — 前端类型（feedback rating=`positive`|`negative`）
- **唯一业务 path**：`/companions`（Keep-Alive 一级）；**禁止** `/companions/new`、`/$id/edit|care|memories|chat` 等二级 file route

> 业务权威：OpenSpec `companion` / `companion-persona` / `companion-care`；壳层纪律见 `web-shell` / change `web-l1-cache-l2-dialogs`。

## Implementation Notes

### 主聊天路径：useChat + CompanionChatTransport

| 层 | 职责 | 文件 |
|----|------|------|
| Page | `@ai-sdk/react` `useChat` | `CompanionChatPage.tsx` |
| Transport | Nest SSE → AI SDK 生命周期 | `companion-chat-transport.ts` |
| 映射 | `token`→delta，`done`→finish，`error`→error | 同上 |
| 约束 | 请求体 **禁止** 用户 LLM API Key | OpenSpec 服务端 LLM 权威 |

错误时：已收 delta **保留**（`UT-TR-partial-error`）。Knowledge Chat **不要**迁到此 Transport。

### 打字机动画（CompanionTypingIndicator）

- **核心**：`setInterval` + `displayedCount`，默认 18ms/字
- **依赖陷阱**：`useEffect` 只依赖 `content`，用函数式 `setDisplayedCount(prev => …)`，勿把 `displayedCount` 放进依赖
- **流式中**轻量打字机；**完成后**再切 `react-markdown` / 重量渲染，避免每 token 解析 Markdown

### CompanionMessageItem

- 用户：右对齐纯文本
- AI 流式中：TypingIndicator
- AI 完成：Markdown + 赞踩；`metadata.care` 等 → 「关怀」标签
- **禁止**把 pipeline metadata JSON 当气泡正文（G-MD-02）

### 反馈 rating 映射

```text
UI 拇指 up/down  ──映射层──►  HTTP/DTO  positive | negative
```

- 类型权威：`packages/data` + 前端 `FeedbackRating`
- 映射只在客户端边界；不得把 `up`/`down` 泄漏为 API 主类型
- 流式中不渲染反馈按钮

### 记忆 UI 纯函数（G-MM-03）

入口：`memory-ui.ts`（与 `CompanionMemoriesPage` 共用，便于单测）

| 函数 | 用途 |
|------|------|
| `filterMemoriesByType` | 类型筛选（`all` 不过滤） |
| `nextMemoryToggleStatus` | active ↔ disabled |
| `replaceMemoryInList` / `removeMemoryFromList` | 列表局部更新 |
| `canSaveMemoryEdit` | trim 后非空才可保存 |

页面负责调 alova；**状态变更逻辑放纯函数**，避免只写在 JSX 里无法测。

### 二级入口：命令式弹层（非路由）

| 入口 | open API | 档位 | 成功后 |
|------|----------|------|--------|
| 新建 | `openCompanionCreateDialog` | 表单中大 | `onSuccess` → 关层 |
| 编辑 | `openCompanionEditDialog` | 表单中大 | 同上；脏数据关前二次确认 |
| 关怀 | `openCompanionCareDialog` | 工作台大面板 | 保存成功关层 |
| 记忆库 | `openCompanionMemoriesDialog` | 工作台大面板 | 单条变更 **不** 关；用户 X 关 |

**契约（与 Overlay 对齐）**：

1. 必须 `openDialog(Comp, props)`；`OverlayHost` 注入 **`onClose`**；禁止直操 `overlayStore`。
2. 业务刷新：调用方传 **`onSuccess(payload?)`**（无感、无整页 loading）；组件成功路径先 `onSuccess` 再 `onClose(true)`（或等价 resolve）。
3. **禁止点遮罩关闭**（Companion 二级专用；**不要**照搬 `CreateKbDialog` 的 `onOpenChange={() => onClose(false)}` 默认关）。用 `onPointerDownOutside` / `onInteractOutside` preventDefault；Esc/X 走同一关闭流程。
4. 表单脏关：`await openDialog(ConfirmDialog, …)` 确认后再 `onClose`；系统确认框可叠在业务层上。
5. 一级 Icon Rail 切换依赖根布局 **`closeAll()`**，勿让弹层跨一级残留。
6. path 始终 `/companions`；无「返回对话」路由按钮。

### 关怀配置

- `openCompanionCareDialog` → 内容来自 `CompanionCarePage` 逻辑（剥离 navigate）
- 场景/语气与后端 `CARE_SCENES` × `CARE_TONES` 对齐（六场景 × 三语气）
- 生成成功后应能在聊天历史看到消息 + 关怀标记

### 创建/编辑主路径

- 内容：`CompanionFormPage` / 等价简表组件，由 open\* 包进 Dialog
- 分段人设 + 可选头像；列表/聊天入口 **open 弹层**，不 `navigate` 子 path
- 服务端 `buildDefaultAgentPrompt` 写库；客户端预览规则宜与之一致
- trim：空串 → `undefined`

### 头像 / 状态标签

- `avatarKey` → `/api/files/{key}`；否则首字母 `toUpperCase()`
- Status：`draft→default` / `published→secondary` / `archived→destructive`

## Testing Checklist

- [ ] Transport：token/done/error 映射与部分错误保留（`packages/web/tests/companion-chat-transport.spec.ts`）
- [ ] 记忆 UI 纯函数（`companion-memory-ui.spec.ts`：筛选/切换/列表更新/canSave）
- [ ] 人设/头像/开场白相关单测（`companion-persona.spec.ts`）
- [ ] 反馈 HTTP 仅 `positive`|`negative`；UI 映射隔离
- [ ] 开场白仅 `messageCount===0` 且 opening 非空
- [ ] Form create/edit trim；头像校验失败有提示
- [ ] 关怀页场景/语气与后端枚举一致；生成后聊天可见标记
- [ ] 气泡不渲染完整 pipeline metadata JSON

## Review Checklist

- [ ] Companion 主路径是否仍是 useChat+Transport（未回退 ant-design/x 聊天）
- [ ] 是否误改 Knowledge Chat 栈
- [ ] rating 是否泄漏 `up`/`down` 到 API
- [ ] 记忆写逻辑是否抽到 `memory-ui` 可测函数
- [ ] 业务变更是否回写 OpenSpec companion / persona / care
- [ ] 新建/编辑/关怀/记忆是否为 **命令式弹层**（path 仍为 `/companions`）
- [ ] 是否误加回 `/companions/$id/*` 二级 file route 或 redirect 壳
- [ ] 弹层是否 `onClose` 桥接 + 禁遮罩关；表单脏关是否二次确认

## Common Pitfalls

- **打字机 useEffect 依赖**：`displayedCount` 进依赖 → 每 tick 重启 interval；只依赖 `content`。
- **API 直接发 up/down**：契约主类型是 `positive`|`negative`，映射留在 UI 边界。
- **记忆逻辑只写在组件 state**：补测困难；抽 `memory-ui.ts`。
- **metadata 当正文**：pipeline 快照仅调试/侧车，气泡只显示 content。
- **开场白重复插入**：非空会话再次进入时禁止再插 opening。
- **流式中反馈**：无完整 messageId，易脏写。
- **表单未 trim**：空串入库导致空白副标题。
- **Knowledge 误迁 AI SDK**：本模块 Non-Goal。
- **二级改 path**：会拆 Keep-Alive → 闪烁；二级只用 openDialog。
- **照搬 KB 小窗 outside=close**：Companion 二级禁止点遮罩关。

## Reusable Patterns

### 打字机动画实现模式

`setInterval + displayedCount + slice(0, n)`，配合 `animate-pulse` 光标；适用于任何纯文本逐字输出场景。

### 流式渲染性能优化模式

流式中用轻量组件（如 CompanionTypingIndicator）消费 token 流，避免每 token 重渲染 Markdown；完成后切换到重量级 Markdown 渲染器。

### 双模式表单实现模式

`mode` prop 切换端点 + toast 文案；统一 trim + undefined 处理；字段定义外置于 OpenSpec，本文件只保留实现骨架。

### group-hover 反馈交互模式

父元素 `group`，子元素 `opacity-0 group-hover:opacity-100 transition-opacity`；适用于消息气泡、卡片操作按钮等"聚焦时显式"场景。

### 三态渲染分支模式

按 `role × streaming` 矩阵分流到不同 children 渲染器，状态切换由 store 标记驱动，组件本身保持无感。

# 功能规格：BlockNote 富文本编辑器集成

> 状态：draft | 关联 issue：f-49 | PRD：§5.7 阶段三深化 + §1.1 背景

---

## 用户故事

作为 GoferBot 用户，我希望在输入消息时使用富文本格式（粗体、斜体、标题、列表、代码块、引用），并能拖入/粘贴图片，以便更丰富地表达我的问题和需求。

## 边界

- **范围内**：
  - 安装 `@blocknote/core` + `@blocknote/react` + `@blocknote/mantine` 依赖
  - 将 `EditorPlaceholder.tsx` 替换为 `BlockNoteEditor.tsx`（完整编辑器组件）
  - 格式化工具栏：粗体、斜体、标题（H1-H3）、无序列表、有序列表、代码块、引用块
  - 图片拖入/粘贴支持（利用 BlockNote 内置文件块能力）
  - 编辑器内容通过 `blocksToMarkdownLossy()` 提取为 Markdown
  - 与 `ChatInput` 的 `onSend` 回调对接（传递 Markdown 内容字符串）
  - 响应式布局：移动端工具栏折叠为悬浮菜单
  - 编辑器初始内容在发送后清空
  - 发送按钮的 disabled 联动（空内容或流式接收中时禁用）

- **范围外**：
  - 不涉及后端消息格式修改（`POST /chat` 的 body 字段保持不变，Markdown 内容仍放在 `content` 字段）
  - 不涉及 BlockNote 的协同编辑功能
  - 不涉及自定义 BlockNote 主题（使用 Mantine 默认样式，通过 Tailwind 外层包裹控制边距/边框）
  - 不涉及图片上传到 MinIO 的完整链路（图片粘贴/拖入仅停留在编辑器内渲染预览，不上传）

## 涉及页面/组件

| 组件 | 路径 | 动作 |
|------|------|------|
| `EditorPlaceholder` | `packages/web/src/components/chat/EditorPlaceholder.tsx` | **删除**（被 BlockNoteEditor 替换） |
| `BlockNoteEditor` | `packages/web/src/components/chat/BlockNoteEditor.tsx` | **新建**（完整编辑器组件） |
| `ChatInput` | `packages/web/src/components/chat/ChatInput.tsx` | **修改**：`onSend` 接口保持 `(content: string) => void`，在调用方负责提取 Markdown |
| `ChatViewPage` | `packages/web/src/routes/app/chat.tsx` | **修改**：将 `EditorPlaceholder` 替换为 `BlockNoteEditor`，集成内容提取逻辑 |

## 相关功能

- **上游 f-44（SSE 流式）** — 确保消息发送链路完整，`BlockNoteEditor` 在 `isStreaming` 期间禁用编辑
- **下游** — 无（本功能为消息输入链路的终端节点）
- **关联 f-35（ChatView 迁移）** — ChatViewPage 当前使用 `EditorPlaceholder` + `ChatInput`，f-49 替换前者并增强后者

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 使用 `@blocknote/mantine` 而非 shadcn 主题 | Mantine 是 BlockNote 官方首推主题，维护活跃、文档完善；shadcn 主题仍在早期阶段。外层用 Tailwind 控制容器样式即可 | 是（后续可切换到 shadcn 主题） |
| 内容提取使用 `blocksToMarkdownLossy()` | BlockNote 内置 API，可将文档块转为 Markdown 字符串；Lossy 是因为部分 BlockNote 特性（如嵌套表格）不在 Markdown 规范内，但本功能范围仅含基础格式，无实际数据丢失 | 否（BlockNote 仅此一种导出方式） |
| 图片仅渲染预览，不上传 MinIO | 图片上传链路涉及后端 FileManager + MinIO 存储，属于 f-46 范围；f-49 聚焦编辑器替换，图片拖入仅做本地预览 | 是（后续可接入上传逻辑，但需新增依赖） |
| `onSend` 接口保持 `(content: string) => void` | 保持 ChatInput 与父组件的接口兼容性，Markdown 提取在父组件完成。避免 ChatInput 内部耦合 BlockNote 类型 | 否（接口契约一旦变更影响 f-35/f-44） |
| 编辑器状态通过 `useRef<BlockNoteEditor>` 暴露给父组件 | React 习惯性模式，避免通过 props 传递编辑器实例。父组件通过 ref 调用 `blocksToMarkdownLossy()` | 是 |

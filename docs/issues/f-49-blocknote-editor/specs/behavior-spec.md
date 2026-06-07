# 行为规格：BlockNote 富文本编辑器集成

> 状态：draft | 关联 issue：f-49

---

## 入口

- **路由**：`/app/chat`（ChatViewPage）
- **触发**：用户打开或切换到对话页面时，BlockNoteEditor 在消息输入区域上方自动渲染
- **角色**：编辑器本身不触发路由切换；它是 ChatViewPage 中的内联组件

## 初始状态

用户进入 ChatViewPage 时：
- BlockNoteEditor 渲染一个空编辑器（无初始内容），显示 placeholder 提示"输入消息..."或"输入消息，支持 Markdown 格式..."
- 格式化工具栏可见（桌面端），包含：粗体、斜体、标题（H1/H2/H3）、无序列表、有序列表、代码块、引用块 图标按钮
- 编辑器获得焦点后工具栏保持可见；失焦后工具栏在当前有内容时保持可见，无内容时隐藏（BlockNote 默认行为）
- 发送按钮初始为 disabled（无内容时）

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| **idle** | 空编辑器，placeholder 可见，工具栏可见 | 点击编辑器 → 获得焦点；开始输入 | 编辑器进入 focused 状态 |
| **editing** | 编辑器有内容，工具栏可见，格式化按钮可按需高亮 | 输入文本、选择格式化、拖入图片 | 实时渲染格式化内容；图片显示缩略图预览 |
| **sending** | 编辑器 disabled（灰色半透明），内容保留但不可编辑，工具栏隐藏，发送按钮显示 spinner | 无操作（编辑器禁用） | SSE 流式接收中；`isStreaming=true` 时锁定编辑器 |
| **sent** | 编辑器清空，回到 idle 状态，焦点自动回到编辑器 | 继续输入新消息 | 发送完成后自动清空编辑器 |
| **empty** | 与 idle 相同 — 空编辑器 + placeholder | 同上 | 同 idle |
| **error** | 编辑器正常可用；若内容提取失败，在编辑器下方显示一行红色提示 `⚠ 内容提取失败，请重试` | 关闭错误提示；手动复制内容重试 | 错误提示 5 秒后自动消失；不影响编辑器继续使用 |
| **mobile** | 工具栏折叠为底部悬浮 "+" 按钮；点击展开为底部 Sheet 面板，列出格式化选项 | 点击 "+" 展开面板；选择格式化项后关闭面板 | 面板选择后应用到当前选区，面板自动收起 |

## 正常流程

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 进入 `/app/chat` | BlockNoteEditor 渲染空编辑器，placeholder 可见 | idle |
| 2 | 点击编辑器区域 | 编辑器获得焦点，光标闪烁，工具栏可见 | editing |
| 3 | 输入文本并选中部分文字，点击工具栏"粗体" | 选中文字变为粗体 | editing（工具栏粗体按钮高亮） |
| 4 | 拖入一张 PNG 图片到编辑器 | 图片渲染为缩略图预览（BlockNote 内置 image block） | editing |
| 5 | 点击发送按钮 | 调用 `editor.blocksToMarkdownLossy()` 提取 Markdown → 传入 `onSend(content)` → 编辑器清空 | idle |
| 6 | 移动端：点击底部 "+" 按钮 | 底部 Sheet 面板滑入，显示格式化选项 | mobile（面板展开） |
| 7 | 移动端：选择一个格式化项（如"标题"） | 面板收起，当前行变为标题样式 | editing |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 内容提取失败 | `blocksToMarkdownLossy()` 抛出异常（极少见，通常为内部状态异常） | 编辑器下方红色文字 `⚠ 内容提取失败，请重试` + 内容保留在编辑器中 | 用户可重新尝试发送，或手动复制内容后刷新页面 |
| BlockNote 初始化失败 | `useCreateBlockNote()` 抛出异常（如 JS 加载失败） | 回退显示原 `EditorPlaceholder` 占位组件（"编辑器加载失败，请刷新页面重试"） | 用户刷新页面重新加载 |
| 图片拖入超大文件 | 用户拖入 >10MB 的图片文件 | 编辑器内不渲染图片，底部 toast `⚠ 图片过大（最大 10MB）` | 用户压缩图片后重新拖入 |
| SSE 连接中断时发送 | `isStreaming=true` 但连接已中断 | 编辑器保持 disabled，直到前端超时逻辑将 `isStreaming` 重置为 false | 等待超时后自动恢复，或用户手动关闭错误 toast |

## 测试映射

| 交互状态 / 验收标准 | 测试文件 | 测试用例 |
|----------|----------|----------|
| AC-01: 安装 BlockNote 依赖 | 不适用（依赖检查，非运行时测试） | — |
| AC-02: EditorPlaceholder → BlockNoteEditor 替换 | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-02: renders BlockNoteEditor instead of EditorPlaceholder` |
| AC-03: 工具栏按钮渲染正确 | E2E 验证（Playwright） | 工具栏由 BlockNote Mantine 内部渲染，单元测试 mock 模式下不可验证 |
| AC-04: 图片拖入/粘贴 | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-04: accepts image drag-and-drop and renders preview` |
| AC-05: 内容提取为 Markdown | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-05: blocksToMarkdownLossy extracts correct markdown for formatted content` |
| AC-06: 与 ChatInput onSend 对接 | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-06: calling onSend passes extracted markdown string` |
| AC-07: 响应式移动端工具栏折叠 | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-07: toolbar collapses on viewport < 768px` |
| loading (编辑器初始化中) | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-08: shows placeholder while BlockNote initializes` |
| error (初始化失败) | `tests/unit/web/blocknote-editor.spec.tsx` | `AC-09: falls back to EditorPlaceholder on init failure` |

> 测试文件路径遵循 `_shared/references/test-paths.md`：React 新项目前端单元测试放在 `tests/unit/web/{name}.spec.tsx`。
> 测试用例名格式：`AC-XX: {描述}`（冒号 + 空格）。

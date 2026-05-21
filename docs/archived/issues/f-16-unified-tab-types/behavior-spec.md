# 行为规格：统一 Tab 类型系统

## 入口
- 无直接用户入口（纯类型/Store 重构，外部行为不变）

## 初始状态
- Store 初始化包含 1 个 home 标签：`{ id: 'home', type: 'chat', title: '首页', sessionId: null, closable: false }`

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | 无（同步操作） | N/A | N/A |
| empty | 仅剩 home 标签 | 无法关闭 home | N/A |
| error | N/A | N/A | N/A |
| success | 标签列表正常渲染 | 正常操作 | 行为与重构前一致 |
| partial | N/A | N/A | N/A |

## 正常流程

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击新建聊天 | `addTab({ type: 'chat' })` 创建新标签，`activeTabId` 切换 | 新标签出现并激活 |
| 2 | 关闭标签 | `closeTab(id)` 移除标签，激活左邻标签 | 标签消失，左邻激活 |
| 3 | 切换标签 | `switchTab(id)` 更新 `activeTabId` | 对应标签高亮 |
| 4 | 重命名标签 | `renameTab(id, title)` 更新 `title` | 标签文字更新 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 关闭不可关闭标签 | `closeTab(id)` 传入 `closable: false` 的标签 | 标签不消失 | 无需恢复，操作被静默拒绝 |
| 关闭不存在的标签 | `closeTab(id)` 传入无效 id | 无变化 | 无需恢复，操作被静默跳过 |

## 类型迁移清单

| 旧（ChatTab） | 新（Tab） |
|---------------|-----------|
| `id: string` | `id: string` |
| `title: string` | `title: string` |
| `sessionId: string \| null` | `sessionId?: string` |
| `closable: boolean` | `closable: boolean` |
| — | `type: TabType`（新增，必填） |
| — | `provider?: string`（保留，chat 可选） |
| — | `model?: string`（保留，chat 可选） |

## 单例/多重逻辑

| 标签类型 | 模式 | 行为 |
|----------|------|------|
| `chat` | 多重 | 每次调用 `addTab` 创建新标签 |
| `knowledgeBase` | 单例 | 已存在则 `switchTab`，不新建 |
| `history` | 单例 | 已存在则 `switchTab`，不新建 |
| `settings` | 单例 | 已存在则 `switchTab`，不新建 |
| `recycleBin` | 单例 | 已存在则 `switchTab`，不新建 |

## 响应式行为
无变化（纯逻辑重构，不影响布局）

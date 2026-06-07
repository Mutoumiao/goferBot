# 行为规格：KB CRUD 完整交互

## 入口

- **路由**：`/app/kb`（KB 列表页）
- **触发**：用户点击侧边栏 TabBar 中的"知识库"标签

## 初始状态

用户进入 KB 页面时：
- 页面发起 `GET /knowledge-base` 请求获取 KB 列表
- 请求期间显示 loading 态（骨架卡片或加载文字）
- 请求成功后渲染 KB 卡片网格
- 请求失败显示错误信息 + 重试按钮
- 若列表为空，显示空状态引导

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | 显示 3 个骨架卡片（灰色占位矩形），"创建知识库"按钮禁用 | 无可用操作 | `GET /knowledge-base` 请求中 |
| empty | 居中显示空状态插画/图标 + "暂无知识库"文字 + "创建第一个知识库"引导按钮 | 点击"创建知识库"按钮 | 弹出 CreateKbDialog |
| error | 显示错误信息（红色文字）+ "重试"按钮 | 点击"重试" | 重新发起 `GET /knowledge-base` |
| success | KB 卡片网格（响应式 1/2/3 列），每张卡片显示名称、描述（截断2行）、文件数 | 悬停卡片、点击卡片、点击"创建知识库"按钮 | 悬停高亮边框；点击进入详情；点击按钮弹出 Dialog |
| partial | 列表正常显示，但某次 CRUD 操作失败 => 显示 Toast 错误提示，列表保持当前数据 | 关闭 Toast，重试操作 | Toast 3 秒后自动消失 |

## 正常流程

### 流程 1：创建知识库

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击页面头部"创建知识库"按钮（+ 图标按钮） | 弹出 CreateKbDialog | Dialog 居中显示，背景半透明遮罩 |
| 2 | 输入名称和描述（描述可选） | 客户端 Zod 实时校验：名称非空、最长100字符；描述字段可选（`z.string().optional()`），不填不触发校验错误，仅校验非空时长度合理 | 输入框正常 / 红色边框+错误提示 |
| 3 | 点击"创建"按钮 | 按钮进入 loading 态（禁用+旋转图标），发送 `POST /knowledge-base` | 按钮文字变为"创建中..." |
| 4a | 请求成功 | Dialog 关闭，列表自动刷新（重新 `GET`），新 KB 出现在列表首位 | 列表无缝更新 |
| 4b | 请求失败（409 名称重复） | Dialog 保持打开，名称输入框下方显示红色错误"该名称已存在" | 输入框红色边框 + 错误文字 |
| 4c | 请求失败（403 权限不足） | Dialog 关闭，页面显示 Toast "权限不足，无法创建知识库" | Toast 顶部滑入，3 秒消失 |
| 4d | 请求失败（网络错误） | Dialog 保持打开，底部显示红色错误"网络连接失败，请检查网络后重试" | 错误文字 + Dialog 创建按钮恢复可用 |

### 流程 2：编辑知识库

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 KB 卡片上的编辑按钮（铅笔图标） | 弹出 EditKbDialog，预填当前名称和描述 | Dialog 显示已有数据 |
| 2 | 修改名称和/或描述（描述可选） | 客户端 Zod 实时校验：名称非空、最长100字符；描述可选，不填不报错 | 同创建流程 |
| 3 | 点击"保存"按钮 | 按钮 loading 态，发送 `PATCH /knowledge-base/:id` | 按钮文字变为"保存中..." |
| 4a | 请求成功 | Dialog 关闭，列表自动刷新，对应卡片内容更新 | 列表无缝更新 |
| 4b | 请求失败（409 名称重复） | 同创建流程 4b | 同创建流程 |
| 4c | 请求失败（403） | 同创建流程 4c | 同创建流程 |

### 流程 3：删除知识库

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 KB 卡片上的删除按钮（垃圾桶图标） | 弹出 DeleteKbDialog，显示"确定要删除知识库「{名称}」吗？此操作不可撤销。" | Dialog 居中，标题红色/警告色 |
| 2 | 点击"删除"按钮 | 按钮进入 loading 态，发送 `DELETE /knowledge-base/:id` | 按钮文字变为"删除中..."，变为 danger 色 |
| 3a | 请求成功 | Dialog 关闭，列表自动刷新，被删除卡片消失 | 列表无缝更新 |
| 3b | 请求失败（403） | Dialog 关闭，Toast "权限不足，无法删除知识库" | Toast 提示 |
| 3c | 请求失败（404 不存在） | Dialog 关闭，Toast "知识库不存在或已被删除"，列表刷新 | Toast + 列表自动刷新 |

### 流程 4：进入知识库详情

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 点击 KB 卡片主体区域（非按钮区域） | 导航至 `/app/kb/$kbId`（由 TanStack Router 处理） | 页面切换至 KB 详情页（f-46 构建的内容） |

## 错误场景

| 场景 | 触发条件 | 视觉表现 | 恢复方式 |
|------|----------|----------|----------|
| 列表加载失败 | `GET /knowledge-base` 返回非 2xx | 页面显示错误文字 + "重试"按钮 | 用户点击"重试"重新请求 |
| 名称重复 | `POST/PATCH` 返回 409 | Dialog 内名称输入框下方显示红色错误提示 | 用户修改名称后重新提交 |
| 权限不足 | 任意 CRUD 返回 403 | Toast 通知"权限不足" | Token 过期则跳转登录；其他则联系管理员 |
| 网络断开 | 请求超时或 `fetch` 抛出 `TypeError` | Dialog 内显示"网络连接失败"（创建/编辑）/ Toast（删除） | 用户检查网络后重试 |
| 名称验证失败（客户端） | 输入为空或超长 | 输入框红色边框 + 下方错误文字 | 用户修正输入 |
| KB 不存在 | `DELETE` 返回 404 | Toast "知识库不存在或已被删除"，列表自动刷新 | 无需手动操作 |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| loading | `tests/unit/web/kb-crud.spec.tsx` | `AC-01: renders loading skeleton while fetching KB list` |
| empty | `tests/unit/web/kb-crud.spec.tsx` | `AC-02: shows empty state when KB list is empty` |
| error | `tests/unit/web/kb-crud.spec.tsx` | `AC-03: displays error message and retry button on list load failure` |
| success | `tests/unit/web/kb-crud.spec.tsx` | `AC-04: renders KB card grid with name, description, file count` |
| create-open | `tests/unit/web/kb-crud.spec.tsx` | `AC-05: opens CreateKbDialog on button click` |
| create-validate | `tests/unit/web/kb-crud.spec.tsx` | `AC-06: shows validation error for empty KB name` |
| create-submit | `tests/unit/web/kb-crud.spec.tsx` | `AC-07: submits create request and refreshes list on success` |
| create-duplicate | `tests/unit/web/kb-crud.spec.tsx` | `AC-08: shows duplicate name error on 409 response` |
| edit-open | `tests/unit/web/kb-crud.spec.tsx` | `AC-09: opens EditKbDialog with pre-filled data` |
| edit-submit | `tests/unit/web/kb-crud.spec.tsx` | `AC-10: submits update request and refreshes list on success` |
| delete-open | `tests/unit/web/kb-crud.spec.tsx` | `AC-11: opens DeleteKbDialog with confirmation message` |
| delete-submit | `tests/unit/web/kb-crud.spec.tsx` | `AC-12: submits delete request and removes card from list` |
| delete-cancel | `tests/unit/web/kb-crud.spec.tsx` | `AC-13: closes DeleteKbDialog without action on cancel` |
| navigate-detail | `tests/unit/web/kb-crud.spec.tsx` | `AC-14: navigates to /app/kb/:id on card click` |
| network-error | `tests/unit/web/kb-crud.spec.tsx` | `AC-15: shows network error message in dialog on request failure` |

> 测试文件位于 `tests/unit/web/kb-crud.spec.tsx`（React 新项目）。用例名以 `AC-XX:` 开头，与 `checklist.json` 中的 `id` 对应。
> 测试策略：`vi.mock('alova/client')` mock `useFetcher` 返回值，验证各交互状态的组件渲染。

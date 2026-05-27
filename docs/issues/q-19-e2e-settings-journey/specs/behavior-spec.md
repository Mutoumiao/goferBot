---
issue_id: q-19
type: behavior-spec
status: draft
summary: 设置页面交互状态与跨模块用户入职旅程的前端行为规格
---

# q-19 行为规格：E2E 设置持久化与用户入职旅程

## 入口

### 设置持久化测试入口
- 路由：`/app/settings`
- 触发：已登录用户点击侧边栏「设置」图标，或直接访问 `/app/settings`

### 用户入职旅程入口
- 路由：`/register`
- 触发：新用户在浏览器地址栏输入注册页地址，或点击登录页「立即注册」链接

## 初始状态

### 设置页面初始状态
- 页面标题显示「设置」
- 默认激活「模型设置」Tab
- LLM 提供商子 Tab 默认选中「OpenAI」
- 各输入框显示从 `GET /api/settings` 获取的当前配置值
- 温度滑块显示当前值（默认 0.7），右侧显示数值标签
- 「保存」按钮置灰（`disabled`），因为尚无修改
- 未显示成功或错误提示

### 入职旅程初始状态
- 注册页显示邮箱、密码、确认密码三个输入框
- 「注册」按钮可点击
- 未显示验证错误提示

## 交互状态

| 状态 | 视觉 | 用户操作 | 系统响应 |
|------|------|----------|----------|
| loading | 设置页：输入框显示骨架屏或 placeholder，保存按钮显示 loading spinner；注册页：注册按钮显示 loading 状态 | 禁用所有交互元素 | 等待 API 响应返回 |
| empty | 设置页：API Key 输入框为空，模型输入框为空；默认提供商下拉框显示「选择默认提供商」placeholder | 用户可输入或选择 | 输入后标记 `hasChanges = true`，保存按钮启用 |
| error | 设置页：底部弹出红色 Toast（`data-testid="settings-error"`），显示具体错误文案（如「温度参数必须在 0-2 之间」）；注册页：输入框包裹元素添加 `has-error` class | 用户可修正输入后重试 | 点击保存或注册时重新校验 |
| success | 设置页：底部弹出绿色 Toast（`data-testid="settings-success"`），显示「保存成功」，3 秒后自动消失；入职流程：页面跳转至 `/app/chat` | 用户可继续操作或离开 | 设置页：`hasChanges` 重置为 false，保存按钮再次置灰 |
| partial | 设置页：部分提供商已配置 API Key，部分未配置；默认提供商下拉仅列出已配置有效 Key 的选项 | 用户可继续补充其他提供商配置 | 切换 Tab 时本地状态保持（未保存到服务器） |

## 正常流程

### 流程 A：设置保存与刷新恢复

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 访问 `/app/settings` | `GET /api/settings` 获取当前配置 | 页面加载完成，显示配置值 |
| 2 | 点击「Claude」Tab | `activeLlmTab` 切换为 `claude` | Claude 配置面板显示，OpenAI 面板隐藏 |
| 3 | 在 API Key 输入框填入 `sk-test-claude` | `markChanged()` 触发，`hasChanges = true` | 保存按钮从置灰变为可点击 |
| 4 | 在模型输入框填入 `claude-3-5-sonnet` | 本地状态更新 | 输入框显示新值 |
| 5 | 拖动温度滑块至 1.2 | `localConfig.temperature` 更新为 1.2 | 数值标签显示「1.2」 |
| 6 | 点击「Embedding」区域，选择提供商「硅基流动」 | 下拉框关闭，显示「硅基流动」 | Embedding 配置面板显示对应输入项 |
| 7 | 点击「保存」按钮 | `POST /api/settings` 发送完整配置 | 保存按钮短暂显示 loading，随后显示绿色「保存成功」Toast |
| 8 | 刷新浏览器页面 | 重新执行 `GET /api/settings` | 所有输入框显示步骤 2-6 中修改的值，与刷新前一致 |

### 流程 B：新用户入职旅程

| 步骤 | 用户操作 | 系统响应 | 视觉状态 |
|------|----------|----------|----------|
| 1 | 访问 `/register` | 页面加载，显示注册表单 | 邮箱、密码、确认密码输入框可见 |
| 2 | 填入邮箱 `onboarding-{timestamp}@test.gofer`、密码 `Test1234!`、确认密码 `Test1234!`、名称 `E2E User` | 表单校验通过 | 无错误提示 |
| 3 | 点击「注册」按钮 | `POST /api/auth/register` 发送请求，成功后自动执行 `POST /api/auth/login` | 注册按钮显示 loading，随后跳转至 `/app/chat` |
| 4 | 在首页点击侧边栏「知识库」进入知识库页面 | `GET /api/knowledge-bases` 获取列表 | 显示知识库列表页面，「创建知识库」按钮可见 |
| 5 | 点击「创建知识库」按钮，输入名称 `我的知识库`，确认 | `POST /api/knowledge-bases` 创建成功 | 新知识库出现在列表中 |
| 6 | 点击进入该知识库，点击「上传文件」，选择测试文件并确认 | `POST /api/knowledge-bases/:kbId/documents/upload` 上传成功 | 文件出现在文件列表中 |
| 7 | 点击侧边栏「首页」返回聊天页面，点击「新建聊天」 | `POST /api/sessions` 创建新会话 | 新标签页显示，输入框可用 |
| 8 | 在输入框输入「你好，请介绍一下自己」，点击发送 | `POST /api/chat` 发送消息，接收 SSE 流式响应 | 用户消息显示在消息列表，AI 回复逐字显示 |
| 9 | 等待 AI 响应完成 | 消息完整渲染 | 消息列表包含用户消息和 AI 响应消息 |

## 错误场景

| 场景 | 触发 | 视觉 | 恢复 |
|------|------|------|------|
| 温度参数越界 | 用户将温度滑块拖动至小于 0 或大于 2（或通过其他方式输入非法值） | 点击保存时底部显示红色 Toast：「温度参数必须在 0-2 之间」，配置未提交 | 用户调整滑块至 0-2 范围内，再次点击保存 |
| 默认提供商无效 | 用户选择了一个未配置 API Key 的提供商作为默认对话提供商 | 点击保存时底部显示红色 Toast：「默认对话提供商必须是已配置且有效的提供商」 | 用户先为该提供商配置 API Key，或选择其他已配置提供商 |
| 保存 API 返回 400 | `POST /api/settings` 返回 400（如 Invalid provider） | 底部显示红色 Toast，文案为服务端返回的错误信息 | 用户检查输入内容，修正后重试保存 |
| 保存 API 返回 500 | `POST /api/settings` 返回 500 | 底部显示红色 Toast：「保存失败，请检查配置」 | 用户稍后重试，或刷新页面重新加载 |
| 注册表单校验失败 | 邮箱格式无效、密码少于 8 位、确认密码不一致 | 对应输入框包裹元素添加 `has-error` class，显示字段级错误提示 | 用户修正对应字段后重新提交 |
| 网络断开导致保存失败 | 提交保存时网络异常 | 请求超时，保存按钮恢复可点击状态，显示错误 Toast | 恢复网络后重新点击保存 |
| 未保存更改离开页面 | 用户修改配置后点击浏览器后退或关闭标签页 | 弹出浏览器原生确认对话框：「配置有未保存的更改，确定要离开吗？」 | 用户选择「取消」留在页面继续编辑，或「确定」放弃更改离开 |

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 设置页面加载所有 Tab | `tests/e2e/specs/settings.spec.ts` | `设置页面正常加载` |
| LLM 提供商 Tab 显示 | `tests/e2e/specs/settings.spec.ts` | `LLM 提供商 Tab 显示正确` |
| 切换 Tab 保持本地状态 | `tests/e2e/specs/settings.spec.ts` | `切换 Tab 保持状态` |
| 保存触发 API 调用 | `tests/e2e/specs/settings.spec.ts` | `保存设置触发 API 调用` |
| 保存失败显示错误 | `tests/e2e/specs/settings.spec.ts` | `保存失败显示错误提示` |
| Embedding Tab 显示 | `tests/e2e/specs/settings.spec.ts` | `Embedding 配置 Tab 显示` |
| 温度滑块可调节 | `tests/e2e/specs/settings.spec.ts` | `温度参数滑块可调节` |
| 设置保存后刷新恢复 | `tests/issues/q-19-e2e-settings-journey/05-settings-persist.spec.ts` | `AC-01: 修改配置后刷新页面数据恢复` |
| 温度越界校验 | `tests/issues/q-19-e2e-settings-journey/05-settings-persist.spec.ts` | `AC-02: 无效温度参数显示错误提示` |
| 空 API Key 允许保存 | `tests/issues/q-19-e2e-settings-journey/05-settings-persist.spec.ts` | `AC-03: 空 API Key 配置可正常保存` |
| 默认提供商无效校验 | `tests/issues/q-19-e2e-settings-journey/05-settings-persist.spec.ts` | `AC-04: 选择未配置提供商作为默认时报错` |
| 注册自动登录 | `tests/e2e/specs/auth.spec.ts` | `成功注册后自动登录` |
| 入职完整旅程 | `tests/issues/q-19-e2e-settings-journey/06-onboarding-journey.spec.ts` | `AC-05: 新用户从注册到首次 AI 响应完整流程` |
| 创建知识库 | `tests/e2e/specs/knowledge-base.spec.ts` | `创建新知识库` |
| 上传文档 | `tests/e2e/specs/knowledge-base.spec.ts` | （待补充：上传文档测试用例） |
| 新建会话并发送消息 | `tests/e2e/specs/chat.spec.ts` | `聊天页面正常加载` |
| AI 响应流式显示 | `tests/e2e/specs/chat.spec.ts` | （待补充：SSE 流式响应测试用例） |

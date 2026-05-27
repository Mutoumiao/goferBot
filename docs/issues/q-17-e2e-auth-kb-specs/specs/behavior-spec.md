# q-17 行为规格：E2E 认证流程与知识库生命周期

## 入口

- **触发条件**：运行 `pnpm test:e2e` 或 `npx playwright test tests/issues/q-17-e2e-auth-kb-specs/`
- **页面入口**：`http://localhost:1420/login`、`http://localhost:1420/register`、`http://localhost:1420/knowledge-bases`
- **前置依赖**：q-16 E2E 基础设施已就绪（docker、前后端、Playwright）

## 初始状态

- 浏览器打开 `baseURL`，localStorage 为空，无登录态
- 后端数据库已执行 `TRUNCATE`，无残留测试数据
- 页面加载时，路由守卫检查登录状态

## 交互状态

| 状态 | 视觉/页面表现 | 触发条件 | 系统响应 |
|------|--------------|----------|----------|
| loading | 页面白屏或显示骨架屏，按钮禁用 | 首次加载页面、提交表单后等待响应 | 前端路由解析中，或 API 请求 pending |
| empty | 表单输入框为空，无错误提示；知识库列表显示"暂无数据" | 刚进入注册/登录/知识库页面 | 等待用户输入或操作 |
| error | 表单字段下方显示红色错误文案；Toast 提示网络错误 | 表单校验失败、API 返回 4xx/5xx、网络超时 | 阻止表单提交，保持当前页面，提示具体错误 |
| success | 注册/登录成功后跳转至首页；知识库创建成功后出现在列表顶部 | API 返回 200 且业务成功 | 写入 localStorage（token），更新路由，刷新列表 |
| partial | 知识库列表部分加载成功，某些文档上传失败 | 批量操作中部分成功 | 成功项正常显示，失败项标红或提示重试 |

## 正常流程

### 注册流程

| 步骤 | 用户操作 | 系统响应 | 验证点 |
|------|----------|----------|--------|
| 1 | 访问 `/register` | 页面渲染注册表单（用户名、邮箱、密码、确认密码） | 表单字段可见，提交按钮初始禁用 |
| 2 | 填写有效信息，点击提交 | 前端调用 `GET /api/auth/public-key` 获取 RSA 公钥 | 请求成功返回公钥 |
| 3 | 系统获取公钥后 | 使用 RSA-OAEP 加密密码，调用 `POST /api/auth/register` | 请求体中 `encryptedPassword` 为密文 |
| 4 | 注册成功 | 自动调用 `POST /api/auth/login` 登录 | 响应包含 `accessToken` 和 `refreshToken` |
| 5 | 登录成功 | 前端将 token 写入 localStorage，跳转至 `/` | `localStorage.getItem('token')` 非空，当前路由为 `/` |

### 登录流程

| 步骤 | 用户操作 | 系统响应 | 验证点 |
|------|----------|----------|--------|
| 1 | 访问 `/login` | 页面渲染登录表单（邮箱、密码） | 表单字段可见 |
| 2 | 填写已注册邮箱和密码，点击提交 | 获取 RSA 公钥并加密密码，调用 `POST /api/auth/login` | 密码以密文传输 |
| 3 | 登录成功 | token 写入 localStorage，跳转至 `/` | `localStorage` 含 token，路由跳转 |
| 4 | 登录失败（密码错误） | 接口返回 401，页面显示"邮箱或密码错误" | 停留在登录页，表单不清空 |

### 知识库生命周期流程

| 步骤 | 用户操作 | 系统响应 | 验证点 |
|------|----------|----------|--------|
| 1 | 已登录用户访问 `/knowledge-bases` | 调用 `GET /api/knowledge-bases` 加载列表 | 列表渲染，空状态或数据正常展示 |
| 2 | 点击"新建知识库" | 弹出创建对话框，输入名称和描述 | 对话框可见，表单校验生效 |
| 3 | 填写信息并确认创建 | 调用 `POST /api/knowledge-bases`，成功后关闭对话框 | 新知识库出现在列表顶部 |
| 4 | 点击进入知识库详情 | 路由跳转至 `/knowledge-bases/:id` | 详情页加载，文档列表为空 |
| 5 | 点击"上传文档"，选择 `test-document.md` | 调用 `POST /api/knowledge-bases/:id/documents/upload` | 上传进度可见，成功后文档出现在列表 |
| 6 | 返回知识库列表，点击删除 | 弹出确认对话框，确认后调用 `DELETE /api/knowledge-bases/:id` | 列表中该知识库消失，进入回收站 |
| 7 | 进入回收站，点击恢复 | 调用恢复接口，知识库回到列表 | 回收站中消失，正常列表中出现 |

### 路由守卫行为

| 场景 | 当前状态 | 访问目标 | 系统行为 |
|------|----------|----------|----------|
| 未登录访问受保护页 | localStorage 无 token | `/knowledge-bases` | 重定向至 `/login` |
| 已登录访问登录页 | localStorage 有有效 token | `/login` 或 `/register` | 重定向至 `/` |
| 已登录访问注册页 | localStorage 有有效 token | `/register` | 重定向至 `/` |
| Token 过期 | localStorage token 失效 | 任意受保护页 | API 返回 401，自动调用刷新接口；刷新失败则重定向至 `/login` |

## 错误场景

| 场景 | 触发 | 表现 | 恢复 |
|------|------|------|------|
| 注册邮箱已存在 | 提交已被注册的邮箱 | 表单邮箱字段下方提示"该邮箱已被注册" | 修改邮箱后重新提交 |
| 注册表单校验失败 | 密码长度不足或两次密码不一致 | 对应字段显示校验错误，提交按钮禁用 | 修正输入后错误消失 |
| 登录密码错误 | 提交错误的密码 | 页面显示"邮箱或密码错误"，无字段级提示 | 重新输入密码 |
| 登录账号不存在 | 提交未注册的邮箱 | 页面显示"邮箱或密码错误"（模糊提示） | 检查邮箱或前往注册 |
| 网络超时 | 后端未响应或网络中断 | Toast 提示"网络异常，请稍后重试" | 检查网络后重试 |
| RSA 公钥获取失败 | `/api/auth/public-key` 返回 5xx | 提交按钮 loading 后提示"服务异常" | 刷新页面重试 |
| 知识库创建名称重复 | 提交已存在的知识库名称 | 对话框显示"知识库名称已存在" | 修改名称后重新提交 |
| 上传文件格式不支持 | 选择非 txt/md/pdf 文件 | 上传前拦截，提示"仅支持 txt、md、pdf 格式" | 选择正确格式文件 |
| 上传文件过大 | 选择超过大小限制的文件 | 上传前拦截或上传中断，提示文件过大 | 压缩或更换文件 |
| 删除知识库取消 | 点击删除后点击取消 | 对话框关闭，知识库保留在列表 | 无需恢复 |
| Token 刷新失败 | `refreshToken` 过期或无效 | 清除 localStorage，跳转登录页 | 重新登录 |

## 测试映射

| 交互状态 | 测试文件 | 测试用例 |
|----------|----------|----------|
| 注册表单填写 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should display register form with all fields` |
| RSA 加密传输 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should encrypt password with RSA public key before submission` |
| 注册成功跳转 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should register successfully and redirect to home` |
| 登录成功存储 Token | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should store accessToken and refreshToken in localStorage after login` |
| 登录错误提示 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should show error message for invalid credentials` |
| 未登录重定向 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should redirect to login when accessing protected page without token` |
| 已登录反重定向 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should redirect to home when accessing login page with valid token` |
| Token 刷新 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should refresh accessToken when expired` |
| 知识库列表加载 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should load knowledge base list on page visit` |
| 知识库创建对话框 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should open create dialog and validate form` |
| 知识库创建成功 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should create new knowledge base and appear in list` |
| 文档上传成功 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should upload document and show in document list` |
| 知识库删除确认 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should show confirm dialog before deleting knowledge base` |
| 知识库软删除 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should move deleted knowledge base to trash` |
| 知识库恢复 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should restore knowledge base from trash to list` |
| 注册邮箱已存在 | `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | `should show error for duplicate email registration` |
| 上传文件格式校验 | `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | `should reject unsupported file formats` |

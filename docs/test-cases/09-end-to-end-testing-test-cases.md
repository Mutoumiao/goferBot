# Issue #09 — 端到端测试体系 测试用例

**对应 Issue**: `.scratch/knowledge-base/issues/09-end-to-end-testing.md`  
**状态**: in-progress  
**测试框架**: Playwright（阶1/阶3）、Vitest（阶2）

---

## 1. 基础设施

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-001 | `pnpm test:e2e` 命令可运行 | Playwright 已安装，Vite dev server 可启动 | 运行 `pnpm test:e2e` | 自动启动 Vite dev server，执行 Playwright 测试，生成 HTML 报告 |
| TC-09-002 | `pnpm test:e2e:ui` 命令可运行 | Playwright 已安装 | 运行 `pnpm test:e2e:ui` | 打开 Playwright UI 模式调试窗口 |
| TC-09-003 | `pnpm test:e2e:codegen` 命令可运行 | Playwright 已安装 | 运行 `pnpm test:e2e:codegen` | 启动录制工具，打开浏览器 |
| TC-09-004 | `pnpm test:integration` 命令可运行 | Vitest 已安装，sidecar 可构建 | 运行 `pnpm test:integration` | 使用 `vitest.integration.config.ts` 执行 Sidecar 集成测试 |
| TC-09-005 | `.gitignore` 排除报告目录 | `.gitignore` 已配置 | 检查 `.gitignore` 内容 | 包含 `tests/e2e/report/`、`test-results/`、`playwright-report/` |
| TC-09-006 | GitHub Actions CI e2e job | `.github/workflows/e2e.yml` 已配置 | push/PR 触发 CI | 自动运行阶1和阶2测试，结果上报 |

**已有自动化测试**: `tests/e2e/playwright.config.ts`、`vitest.integration.config.ts`（待创建）  
**覆盖范围**: TC-09-001 ~ TC-09-006

---

## 2. 阶1：前端 E2E — HTTP 路由 Mock

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-007 | `http-routes.ts` 统一拦截 sidecar 请求 | 页面已加载 mock | 调用 `mockHttpRoutes(page)` 后访问知识库页 | 所有对 `127.0.0.1:*` 的请求被拦截并返回预设 mock 数据 |
| TC-09-008 | mock 数据覆盖默认知识库列表 | `mockHttpRoutes` 已注入 | 加载知识库页面 | 页面渲染 `defaultKbList` 中的数据 |
| TC-09-009 | mock 数据覆盖会话列表 | `mockHttpRoutes` 已注入 | 加载历史页面 | 页面渲染 `defaultSessionList` 中的数据 |
| TC-09-010 | mock 覆盖支持自定义 override | 需要覆盖特定路由 | 传入 `overrides` 参数 | 自定义 handler 优先于默认 handler |

**已有自动化测试**: `tests/e2e/mocks/http-routes.ts`（待创建）  
**覆盖范围**: TC-09-007 ~ TC-09-010

---

## 3. 阶1：前端 E2E — Page Object Model

### 3.1 HistoryPage

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-011 | HistoryPage 导航到历史页 | mock IPC 和 HTTP 已注入 | `history.goto()` | 页面 URL 为 `/history`，列表可见 |
| TC-09-012 | HistoryPage 获取会话列表 | 历史页有数据 | `history.getSessionItems()` | 返回 Locator 数组，长度大于 0 |
| TC-09-013 | HistoryPage 点击会话恢复聊天 | 历史页有名为 "Hello" 的会话 | `history.clickSession('Hello')` | 页面跳转至 `/chat` |
| TC-09-014 | HistoryPage 删除会话显示确认 | 历史页有数据 | `history.deleteSession('Hello')` | 确认弹窗可见 |
| TC-09-015 | HistoryPage 重命名会话 | mock rename API 返回成功 | `history.renameSession('Hello', 'Renamed')` | 列表中显示 "Renamed" |
| TC-09-016 | HistoryPage 新建对话按钮 | 历史页已加载 | `history.newChatBtn.click()` | 页面跳转至 `/chat` |

**已有自动化测试**: `tests/e2e/pages/HistoryPage.ts`（待创建）  
**覆盖范围**: TC-09-011 ~ TC-09-016

### 3.2 SettingsPage

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-017 | SettingsPage 导航到设置页 | mock IPC 和 HTTP 已注入 | `settings.goto()` | 页面 URL 为 `/settings`，tab 可见 |
| TC-09-018 | SettingsPage 切换 tab | 设置页已加载 | `settings.clickTab('模型')` | 模型设置区域可见 |
| TC-09-019 | SettingsPage 切换 tab 状态保留 | 已切换到模型 tab | 切回通用再切回模型 | 模型设置区域仍然可见（无整页刷新） |
| TC-09-020 | SettingsPage 填写输入框 | 设置页已加载 | `settings.fillInput('apiKey', 'test')` | 输入框值为 "test" |
| TC-09-021 | SettingsPage 点击保存 | mock settings API 返回成功 | `settings.save()` | API 被调用，保存成功提示 |
| TC-09-022 | SettingsPage 错误提示 | mock settings API 返回 400 | `settings.save()` | 错误信息可见，`getErrorMessages()` 返回非空数组 |

**已有自动化测试**: `tests/e2e/pages/SettingsPage.ts`（待创建）  
**覆盖范围**: TC-09-017 ~ TC-09-022

---

## 4. 阶1：前端 E2E — 知识库右键菜单（#03b 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-023 | E2E-01：右键置顶知识库 | 知识库列表有 "Default KB" | 右键该知识库，选择"置顶" | 该知识库出现在列表首位 |
| TC-09-024 | E2E-02：右键修改资料 | 知识库列表有数据 | 右键选择"修改资料" | 编辑资料弹窗可见 |
| TC-09-025 | E2E-03：右键移入回收站 | 知识库列表有数据 | 右键选择"移入回收站" | 确认弹窗可见 |
| TC-09-026 | E2E-04：弹窗文案验证 | 触发删除/移入回收站 | 观察弹窗内容 | 文案与产品设计一致 |
| TC-09-027 | E2E-05：文件区域新建文件夹 | 文件资源管理器已加载 | 右键空白处选择"新建文件夹" | 新建文件夹弹窗可见 |
| TC-09-028 | E2E-06：文件右键重命名 | 文件列表有文件 | 右键文件选择"重命名" | 重命名输入框可见 |
| TC-09-029 | E2E-07：文件右键移动 | 文件列表有文件 | 右键文件选择"移动" | 移动目标选择弹窗可见 |
| TC-09-030 | E2E-08：文件右键复制 | 文件列表有文件 | 右键文件选择"复制" | 复制目标选择弹窗可见 |
| TC-09-031 | E2E-09：文件冲突处理 | 复制/移动到同名文件目录 | 确认复制/移动 | 冲突处理弹窗可见（覆盖/重命名/取消） |
| TC-09-032 | E2E-10：文件永久删除 | 文件列表有文件 | 右键选择"永久删除" | 确认弹窗可见，确认后文件消失 |
| TC-09-033 | E2E-11：回收站入口可见 | 任意页面 | 观察导航或知识库页 | 回收站入口可见 |
| TC-09-034 | E2E-12：回收站恢复同名重命名 | 回收站有名为 "file.md" 的文件，原目录已有同名文件 | 右键恢复该文件 | 文件被恢复并重命名为 "file (1).md" |

**已有自动化测试**: `tests/e2e/specs/kb-context-menu.spec.ts`（已覆盖 3 条，待扩展至 12 条）  
**覆盖范围**: TC-09-023 ~ TC-09-034

---

## 5. 阶1：前端 E2E — 设置页交互（#05 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-035 | 设置页导航渲染 tab | mock 已注入 | 打开 `/settings` | 导航 tab 可见（通用/模型等） |
| TC-09-036 | Tab 单例切换不刷新 | 设置页已加载 | 切换 tab 后再切回 | 内容保留，无整页加载 |
| TC-09-037 | 表单保存触发 API | 设置页已加载，填写表单 | 点击保存 | POST `/settings` 被调用 |
| TC-09-038 | 保存失败显示错误提示 | mock API 返回 400 | 点击保存 | 错误提示 DOM 可见 |

**已有自动化测试**: `tests/e2e/specs/settings.spec.ts`（待创建）  
**覆盖范围**: TC-09-035 ~ TC-09-038

---

## 6. 阶1：前端 E2E — 历史页交互（#06 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-039 | 打开历史页 | mock 已注入 | 打开 `/history` | 历史列表可见 |
| TC-09-040 | 历史列表渲染 | 有历史会话数据 | 观察历史页 | 列表项数量与 mock 数据一致 |
| TC-09-041 | 点击会话恢复聊天 | 列表有 "Hello" 会话 | 点击该会话 | 跳转至 `/chat`，携带会话内容 |
| TC-09-042 | 删除会话确认 | 列表有数据 | 点击删除按钮 | 确认弹窗可见 |
| TC-09-043 | 重命名会话更新显示 | mock rename API 成功 | 重命名 "Hello" 为 "Renamed" | 列表显示 "Renamed" |
| TC-09-044 | 标签标题同步 | 历史页和聊天页切换 | 重命名会话后切换页面 | 聊天页标题与历史页一致 |

**已有自动化测试**: `tests/e2e/specs/chat-history.spec.ts`（待创建）  
**覆盖范围**: TC-09-039 ~ TC-09-044

---

## 7. 阶2：Sidecar 集成测试 — 基础设施

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-045 | `startSidecar(tmpDir)` 启动真实进程 | `server/dist/index.js` 存在 | 调用 `startSidecar()` | 返回端口号和临时目录，`.sidecar-port` 文件出现 |
| TC-09-046 | `stopSidecar()` 停止并清理 | sidecar 已启动 | 调用 `stopSidecar()` | 进程退出，临时目录被删除 |
| TC-09-047 | mock Embedding Server 返回固定向量 | 已启动 mock server | POST `/v1/embeddings` | 返回 1536 维向量，OpenAI 兼容格式 |
| TC-09-048 | mock LLM Server 返回 SSE 流 | 已启动 mock server | POST `/v1/chat/completions` | 返回 `text/event-stream`，含 `[DONE]` |
| TC-09-049 | Vitest `pool: 'forks'` 进程隔离 | `vitest.integration.config.ts` 已配置 | 运行多个集成测试 | 各测试用例独立进程，互不干扰 |

**已有自动化测试**: `tests/integration/setup.ts`、`tests/integration/mocks/embedding-server.ts`、`tests/integration/mocks/llm-server.ts`（均待创建）  
**覆盖范围**: TC-09-045 ~ TC-09-049

---

## 8. 阶2：Sidecar 集成测试 — RAG 全链路（#04 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-050 | TC-04-066：文件导入 → 自动索引 → 可检索 | sidecar + mock embedding 已启动 | 创建 KB → 导入文件 → 轮询 index-status → chat 查询 | index-status 变为 completed，chat 返回含 "RAG works" 的 SSE |
| TC-09-051 | TC-04-067：`@提及` → 选择知识库 → 发送 → 检索生效 | sidecar + mock 已启动 | 创建 KB 并导入文件 → chat 请求带 `knowledgeBaseIds` | SSE 响应包含检索到的内容 |
| TC-09-052 | TC-04-068：重建索引后旧数据不残留 | sidecar + mock 已启动 | 导入文件 → 重建索引 → 查询旧内容 | 旧 chunk 不再被检索到 |
| TC-09-053 | TC-04-069：跨知识库检索 | sidecar + mock 已启动 | 创建两个 KB 各导入文件 → chat 同时提及两个 KB | 检索结果包含两个 KB 的内容 |
| TC-09-054 | TC-04-070：未提及知识库时不触发 RAG | sidecar + mock 已启动 | 创建 KB 导入文件 → chat 不带 `knowledgeBaseIds` | SSE 响应不包含检索到的内容 |

**已有自动化测试**: `tests/integration/sidecar/rag-flow.spec.ts`（待创建）  
**覆盖范围**: TC-09-050 ~ TC-09-054

---

## 9. 阶2：Sidecar 集成测试 — 索引同步（#04b 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-055 | TC-04b-001：跨库移动后索引同步 | sidecar 已启动，两个 KB 各含文件 | 将文件从 KB1 移动到 KB2 | KB1 的 chunk/vec/fts 记录被清除，KB2 新增记录 |
| TC-09-056 | TC-04b-002：跨库移动后原库可正常检索 | sidecar 已启动 | 移动文件后查询 KB1 | 不再返回被移动文件的内容 |
| TC-09-057 | TC-04b-003：跨库移动后目标库可正常检索 | sidecar 已启动 | 移动文件后查询 KB2 | 返回被移动文件的内容 |
| TC-09-058 | TC-04b-004：跨库移动后文件系统一致性 | sidecar 已启动 | 检查物理目录 | 文件实际存在于 KB2 目录，KB1 目录不存在该文件 |
| TC-09-059 | TC-04b-005：跨库复制后索引同步 | sidecar 已启动 | 将文件从 KB1 复制到 KB2 | KB1 保留原记录，KB2 新增相同内容的记录 |
| TC-09-060 | TC-04b-006：跨库复制后两库均可检索 | sidecar 已启动 | 分别查询 KB1 和 KB2 | 两库均返回该文件内容 |
| TC-09-061 | TC-04b-007：跨库复制后文件系统一致性 | sidecar 已启动 | 检查物理目录 | 两目录均存在该文件 |
| TC-09-062 | TC-04b-008：复制同名文件冲突处理 | sidecar 已启动，目标库已有同名文件 | 复制同名文件 | 返回冲突错误或自动重命名 |
| TC-09-063 | TC-04b-009：知识库重命名后索引保留 | sidecar 已启动，KB 含索引文件 | 重命名知识库 | 原 chunk/vec/fts 记录仍然存在，可正常检索 |
| TC-09-064 | TC-04b-010：知识库重命名后文件系统一致性 | sidecar 已启动 | 检查物理目录 | 目录名与知识库新名一致 |
| TC-09-065 | TC-04b-011：知识库重命名后配置引用更新 | sidecar 已启动 | 读取配置或会话关联 | 知识库 ID 不变，名称已更新 |
| TC-09-066 | TC-04b-012：知识库重命名边界（空名/长名） | sidecar 已启动 | 重命名为空字符串或超长字符串 | API 返回 400 或按产品规则处理 |
| TC-09-067 | TC-04b-013：文件重命名后索引同步 | sidecar 已启动，文件已索引 | 重命名文件 | 索引记录中的文件名更新 |
| TC-09-068 | TC-04b-014：文件重命名后可检索 | sidecar 已启动 | 重命名后查询 | 内容仍可被检索 |
| TC-09-069 | TC-04b-015：文件重命名后文件系统一致性 | sidecar 已启动 | 检查物理目录 | 磁盘文件名已更新 |
| TC-09-070 | TC-04b-016：文件重命名边界（空名/特殊字符） | sidecar 已启动 | 重命名为非法名称 | API 返回 400 |
| TC-09-071 | TC-04b-017：vec 无需更新的场景 | 文件内容未变仅移动 | 执行移动操作 | vec 数据不重新计算，仅更新元数据 |
| TC-09-072 | TC-04b-018：队列入队参数正确 | sidecar 已启动 | 执行文件操作 | 索引队列接收正确的 `kbId` 和 `fileId` |
| TC-09-073 | TC-04b-019：无索引文件不报错 | KB 不含可索引文件 | 执行同步操作 | 操作成功，无异常 |
| TC-09-074 | TC-04b-020：批量操作一致性 | sidecar 已启动 | 批量移动/复制多个文件 | 所有文件的索引状态与文件系统一致 |

**已有自动化测试**: `tests/integration/sidecar/index-sync.spec.ts`（待创建）  
**覆盖范围**: TC-09-055 ~ TC-09-074

---

## 10. 阶2：Sidecar 集成测试 — 会话 API（#06 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-075 | 会话列表 | sidecar 已启动 | GET `/sessions` | 返回会话数组 |
| TC-09-076 | 创建会话 | sidecar 已启动 | POST `/sessions` | 返回新会话对象 |
| TC-09-077 | 重命名会话 | 会话已存在 | POST `/sessions/{id}/rename` | 名称更新成功 |
| TC-09-078 | 删除会话级联消息 | 会话含消息 | DELETE `/sessions/{id}` | 会话及关联消息被删除 |
| TC-09-079 | 删除后不可访问 | 会话已删除 | GET `/sessions/{id}` | 返回 404 |

**已有自动化测试**: `tests/integration/sidecar/sessions.spec.ts`（待创建）  
**覆盖范围**: TC-09-075 ~ TC-09-079

---

## 11. 阶2：Sidecar 集成测试 — 配置 API（#05 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-080 | 默认配置结构 | sidecar 已启动 | GET `/settings` | 返回包含 `embeddingProvider` 和 `llmProvider` 的对象 |
| TC-09-081 | 保存配置 | sidecar 已启动 | POST `/settings` | 返回 200，配置持久化 |
| TC-09-082 | 读取配置验证持久化 | 配置已保存 | GET `/settings` | 返回与保存时一致的数据 |
| TC-09-083 | API Key 脱敏/加密 | 配置含敏感信息 | GET `/settings` | API Key 不返回明文，或返回掩码 |
| TC-09-084 | 配置文件加密存储 | sidecar 已启动 | 检查磁盘 `config.json` | 文件内容非明文 JSON（加密或编码） |
| TC-09-085 | 配置验证（无效 provider） | sidecar 已启动 | POST 无效配置 | 返回 400 及错误信息 |

**已有自动化测试**: `tests/integration/sidecar/settings-api.spec.ts`（待创建）  
**覆盖范围**: TC-09-080 ~ TC-09-085

---

## 12. 阶2：Sidecar 集成测试 — Sidecar 生命周期（#01 场景）

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-086 | 端口发现 | sidecar 未启动 | 调用 `startSidecar()` | 返回有效端口号，`.sidecar-port` 存在 |
| TC-09-087 | 健康检查 | sidecar 已启动 | GET `/health` | 返回 200，`{ status: 'ok' }` |
| TC-09-088 | 自动重启 | sidecar 运行中 | kill sidecar 进程 | monitor 检测到退出，重新 spawn，新端口写入文件 |
| TC-09-089 | 退避策略 | sidecar 脚本持续不可执行 | 观察重启间隔 | 前 5 次间隔 5s，超过后间隔 60s |
| TC-09-090 | 优雅关闭 | sidecar 运行中 | 调用 `stopSidecar()` | 进程收到 SIGTERM 后退出，临时目录清理 |
| TC-09-091 | 端口递增 | sidecar 重启后 | 读取 `.sidecar-port` | 新端口号与旧端口号不同 |

**已有自动化测试**: `tests/integration/sidecar/sidecar-lifecycle.spec.ts`（待创建）  
**覆盖范围**: TC-09-086 ~ TC-09-091

---

## 13. 阶3：全链路验收 — 基础设施

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-092 | CDP 配置连接 | Tauri 应用已打包 | 运行 `pnpm test:e2e:full` | Playwright 通过 `ws://127.0.0.1:9222` 连接 WebView2 |
| TC-09-093 | Tauri 应用启动 | 打包产物存在 | `launchTauriApp()` | 应用窗口出现，CDP 端口可连接 |
| TC-09-094 | 调试端口暴露 | `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 已设置 | 检查端口 9222 | 可通过 HTTP 获取 DevTools 版本信息 |

**已有自动化测试**: `tests/e2e-full/playwright.config.ts`、`tests/e2e-full/setup.ts`（均待创建）  
**覆盖范围**: TC-09-092 ~ TC-09-094

---

## 14. 阶3：全链路验收 — 核心用户旅程

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-095 | 旅程1：创建知识库 → 导入文件 → 验证索引进度 | Tauri 应用运行 | 在 UI 中创建 KB → 导入文件 → 观察进度 | 索引完成，文件出现在 KB 中 |
| TC-09-096 | 旅程2：`@提及` → 发送消息 → 验证 LLM 回答含检索内容 | Tauri 应用运行，KB 已索引 | 在 chat 输入 `@` 选择 KB → 发送问题 | LLM 回答包含检索到的 KB 内容 |
| TC-09-097 | 旅程3：设置页保存配置 → 新建会话 → 验证使用默认模型 | Tauri 应用运行 | 打开设置 → 保存模型配置 → 新建会话 → 发送消息 | 会话使用设置中指定的默认模型 |

**已有自动化测试**: `tests/e2e-full/specs/smoke.spec.ts`（待创建）  
**覆盖范围**: TC-09-095 ~ TC-09-097

---

## 15. 测试统计与目标验证

| TC-ID | 测试项 | 前置条件 | 测试步骤 | 预期结果 |
|---|---|---|---|---|
| TC-09-098 | 手动验证场景降为 0 | 所有自动化测试已运行 | 对比原 40+ 手动场景清单 | 每个手动场景均有对应自动化脚本 |
| TC-09-099 | 阶1 测试文件数达标 | 所有阶1 specs 已创建 | `ls tests/e2e/specs/*.spec.ts \| wc -l` | 结果 ≥ 4 |
| TC-09-100 | 阶1 用例数达标 | 所有阶1 specs 运行 | `pnpm test:e2e --reporter=list` | 用例数 ≥ 30 |
| TC-09-101 | 阶2 测试文件数达标 | 所有阶2 specs 已创建 | `ls tests/integration/sidecar/*.spec.ts \| wc -l` | 结果 ≥ 5 |
| TC-09-102 | 阶2 用例数达标 | 所有阶2 specs 运行 | `pnpm test:integration --reporter=list` | 用例数 ≥ 40 |
| TC-09-103 | 阶3 测试文件数达标 | 阶3 specs 已创建 | `ls tests/e2e-full/specs/*.spec.ts \| wc -l` | 结果 ≥ 1 |
| TC-09-104 | 阶3 用例数达标 | 阶3 specs 运行 | `pnpm test:e2e:full --reporter=list` | 用例数 ≥ 3 |

**覆盖范围**: TC-09-098 ~ TC-09-104

---

## 待补充的自动化测试

| TC-ID 范围 | 测试层 | 建议方案 |
|---|---|---|
| TC-09-045 ~ TC-09-049 | 阶2 基础设施 | `tests/integration/setup.ts` + `mocks/` + `vitest.integration.config.ts` |
| TC-09-050 ~ TC-09-054 | 阶2 Sidecar | `tests/integration/sidecar/rag-flow.spec.ts` |
| TC-09-055 ~ TC-09-074 | 阶2 Sidecar | `tests/integration/sidecar/index-sync.spec.ts` |
| TC-09-075 ~ TC-09-079 | 阶2 Sidecar | `tests/integration/sidecar/sessions.spec.ts` |
| TC-09-080 ~ TC-09-085 | 阶2 Sidecar | `tests/integration/sidecar/settings-api.spec.ts` |
| TC-09-086 ~ TC-09-091 | 阶2 Sidecar | `tests/integration/sidecar/sidecar-lifecycle.spec.ts` |
| TC-09-092 ~ TC-09-094 | 阶3 基础设施 | `tests/e2e-full/playwright.config.ts` + `setup.ts` |
| TC-09-095 ~ TC-09-097 | 阶3 验收 | `tests/e2e-full/specs/smoke.spec.ts` |
| TC-09-007 ~ TC-09-010 | 阶1 Mock | `tests/e2e/mocks/http-routes.ts` |
| TC-09-011 ~ TC-09-022 | 阶1 POM | `tests/e2e/pages/HistoryPage.ts` + `SettingsPage.ts` |
| TC-09-023 ~ TC-09-034 | 阶1 E2E | 扩展 `tests/e2e/specs/kb-context-menu.spec.ts` |
| TC-09-035 ~ TC-09-038 | 阶1 E2E | `tests/e2e/specs/settings.spec.ts` |
| TC-09-039 ~ TC-09-044 | 阶1 E2E | `tests/e2e/specs/chat-history.spec.ts` |

---

*文档生成日期：2026-05-13*  
*对应 Issue：#09-end-to-end-testing*

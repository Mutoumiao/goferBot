# 交接文档 — q-18 E2E 聊天 + 会话管理测试

**日期**: 2026-05-28  
**状态**: q-18 完成，q-19 待开发  
**当前分支**: master

---

## 已完成工作

### q-18 20 条 E2E 测试全部通过

两个 spec 文件完成并通过：

| 文件 | 覆盖内容 | 测试数 |
|------|----------|--------|
| `tests/issues/q-18-e2e-chat-session-specs/03-chat-with-rag.spec.ts` | AC-01~AC-08b: 聊天 SSE 流式响应 + @提及知识库 | 9 |
| `tests/issues/q-18-e2e-chat-session-specs/04-session-management.spec.ts` | AC-09~AC-19: Tab 管理 + 历史记录管理 | 11 |

所有测试 100% 通过，使用真实后端 API（chat SSE 部分使用 mock）。

### 修复的生产代码 Bug

1. **Vue 响应式 Bug — `session.ts` `onChunk`**
   - 路径: `packages/webui/src/stores/session.ts:161-191`
   - 问题: `messages.value.set()` 在 `ref(Map)` 上不触发响应式更新；`assistantMsg` 作为普通对象，属性修改不会触发子组件重渲染
   - 修复: ① 每次 `onChunk` 创建新 `assistantMsg` 对象 ② `messages.value = new Map(messages.value)` 触发 Map 引用变化

2. **TabBar 关闭按钮点击无效**
   - 路径: `packages/webui/src/components/layout/TabBar.vue:107-112`
   - 问题: `lucide-vue-next` 的 `XIcon` SVG 组件上 `@click.stop` 不生效
   - 修复: 用 `<span>` 包裹 `XIcon`，click 事件绑定在 `span` 上
   - 同时添加了 `data-active` 属性支持测试断言

3. **HistoryPage 点击历史会话路由冲突**
   - 路径: `packages/webui/src/components/HistoryPage.vue:135-139`
   - 问题: `router.push` 直接跳转 chat 后，`AuthenticatedLayout` 的 watch 检测到 activeTab 仍是 history，又 push 回 history
   - 修复: 改用 `tabsStore.addTab('chat', sessionId)` 创建新 chat 标签，让 watch 自动同步路由

4. **HistoryPage 的 session-open-btn 点击不触发**
   - 路径: `packages/webui/src/components/HistoryPage.vue:285-291`
   - 问题: `reka-ui` 的 `Button`（`Primitive` 组件）的 `@click` 在特定场景下不触发
   - 修复: 替换为原生 `<button>` 元素

### 修复的测试/基础设施代码

5. **`mockApiRoutes` 数据格式修正**
   - Settings mock: deepseek `apiKey` 从 `''` 改为 `'fake-api-key-for-e2e'`
   - `/api/sessions/*` GET mock: 从扁平格式改为 `{ session: {...}, messages: [...] }`
   - 路径: `tests/e2e/mocks/http-routes.ts`

6. **`auth.ts` fixture IPv6 修复**
   - 所有 `fetch('http://localhost:3000/...')` 改为 `fetch('http://127.0.0.1:3000/...')`
   - 路径: `tests/e2e/fixtures/auth.ts`

7. **E2E 后端启动方式重构**
   - `playwright.config.ts`: 移除后端 webServer（避免与 globalSetup 重复启动）
   - `playwright.global-setup.ts`: 新增后端 auto-start 逻辑（带 healh check）
   - 路径: `tests/e2e/playwright.config.ts`, `tests/e2e/playwright.global-setup.ts`

---

## 下一步：q-19

q-19 覆盖 settings persist + onboarding 旅程测试，目前被 q-17 阻塞（q-17 已完成）。

参考文件:
- Issue: `docs/issues/q-19-*-*/issue.md`
- 测试目录: `tests/issues/q-19-*-*/`

---

## 建议的 Skills

按顺序：
1. `/dev-orchestrator` — 启动 q-19 开发流程（检查 spec → plan → tests）
2. 如需写测试: `test-driven-development`
3. 如需代码审查: `/kb-review`

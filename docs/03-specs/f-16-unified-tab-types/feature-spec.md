# 功能规格：统一 Tab 类型系统

## 用户故事
作为开发者，我希望项目中只有一个 Tab 类型定义和统一的 Store，以便所有标签相关功能共享同一套类型契约，消除 ChatTab 与 Tab 的类型分裂。

## 边界
- 范围内：
  - 删除 `chatTabs.ts` 中的 `ChatTab` 接口
  - `types/index.ts` 的 `Tab` 接口成为唯一标签类型
  - `TabType` 联合类型覆盖全部 5 种业务页面
  - Store 重命名为 `tabs.ts`（`useTabsStore`）
  - Store 支持单例标签（非 chat 类型）与多重标签（chat 类型）
  - ChatView 消费者类型迁移
- 范围外：
  - TabBar UI 提升（f-15）
  - 路由元数据集成（f-17）
  - 标签持久化

## 涉及页面/组件
- `packages/webui/src/stores/chatTabs.ts` → `tabs.ts`（重构）
- `packages/webui/src/types/index.ts`（落地使用）
- `packages/webui/src/views/ChatView.vue`（消费者适配）
- `packages/webui/src/components/TabBar.vue`（Props 类型适配）

## 相关功能
- f-04-tab-bar（已关闭） — 当前 ChatTab 定义的来源
- f-15-global-tab-bar — 消费统一 Store
- f-17-route-singleton-tabs — 消费统一 Store

## 已做决策
| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Store 命名为 `tabs.ts` 而非 `chatTabs.ts` | Store 管理全部类型标签，不再局限于 chat | 否（语义准确） |
| `Tab.type` 字段必填，chat 类型默认值 `'chat'` | 明确区分标签类别，单例/多重逻辑依赖此字段 | 否 |
| 单例逻辑内置于 Store 的 `addTab` 中 | 比分散在调用方更可靠，locality 高 | 是（f-17 将迁移至独立配置表 `TAB_ROUTE_CONFIG` 驱动） |
| 保留 `updateHomeTabSession` 方法 | home 标签特殊语义（无对话入口），需保留 | 是 |

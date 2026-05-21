# 功能规格：清理 ChatPage.vue 僵尸组件

## 用户故事
作为开发者，我希望删除未引用的遗留组件 ChatPage.vue，以减少代码库噪音和维护负担。

## 边界
- 范围内：
  - 删除 `packages/webui/src/components/ChatPage.vue`
  - 验证零引用
  - 验证构建通过
- 范围外：
  - 其他遗留组件清理
  - 类型清理（f-16 负责）

## 涉及页面/组件
- `packages/webui/src/components/ChatPage.vue`（删除）

## 相关功能
- 无上下游依赖（孤立文件）

## 已做决策
| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 直接删除，不做 deprecation 过渡 | 零引用，无消费者需迁移 | 是（可从 git 恢复） |

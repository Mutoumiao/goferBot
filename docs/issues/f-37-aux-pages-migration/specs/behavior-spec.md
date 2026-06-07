# 行为规格：辅助页面迁移

> 状态：draft | 关联 issue：f-37

---

## 1. Settings 未保存提示

| 事件 | 行为 |
|------|------|
| 修改配置后未保存 → 点击导航离开 | 弹出"有未保存的更改，是否离开？" |
| 点击"离开" | 丢弃更改，跳转 |
| 点击"取消" | 停留在当前页 |

## 2. 错误场景

| 页面 | 场景 | 用户可见 |
|------|------|----------|
| History | 加载失败 | "加载历史记录失败" + 重试 |
| Settings | 保存失败 | "保存失败，请重试" |
| RecycleBin | 恢复失败 | "恢复失败" + Toast |
| Sidebar | 会话列表加载失败 | Sidebar 底部显示错误提示 |

## 3. 测试映射

| AC | 测试文件 |
|----|----------|
| AC-01 | `tests/unit/web/history-page.spec.tsx` |
| AC-02 | `tests/unit/web/settings-page.spec.tsx` |
| AC-03 | `tests/unit/web/recycle-bin-page.spec.tsx` |
| AC-04 | `tests/unit/web/sidebar.spec.tsx` |
| AC-05 | `tests/unit/web/stores/*.spec.ts` |

# API 规格：辅助页面迁移

> 状态：draft | 关联 issue：f-37

---

## 涉及的 API 端点

| 方法 | 路径 | 用到的页面/组件 |
|------|------|----------------|
| GET | `/sessions` | HistoryPage, Sidebar |
| PUT | `/settings` | SettingsPage |
| GET | `/settings` | SettingsPage（初始值） |
| GET | `/kb/recycle` | RecycleBinPage |
| POST | `/kb/:id/restore` | RecycleBinPage |
| DELETE | `/kb/:id/permanent` | RecycleBinPage |

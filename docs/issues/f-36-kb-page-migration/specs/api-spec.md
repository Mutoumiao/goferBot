# API 规格：知识库页面迁移

> 状态：draft | 关联 issue：f-36

---

## 1. 涉及的 API 端点

| 方法 | 路径 | alova method | 说明 |
|------|------|-------------|------|
| GET | `/kb` | `getKbList(params)` | 分页列表 |
| GET | `/kb/:id` | `getKbDetail(id)` | 详情 |
| POST | `/kb` | `createKb(data)` | 创建 |
| DELETE | `/kb/:id` | `deleteKb(id)` | 删除 |
| POST | `/kb/upload` | `uploadFile(kbId, file)` | 文件上传 |

所有端点复用现有 NestJS API，前端仅封装 alova method 调用。

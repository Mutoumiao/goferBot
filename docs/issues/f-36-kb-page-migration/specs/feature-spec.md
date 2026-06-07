# 功能规格：知识库页面迁移

> 状态：draft | 关联 issue：f-36 | PRD：§5.3 P1

---

## 1. 目标

迁移 KnowledgeBasePage — KB API（alova useRequest/useForm/useUploader）+ 文档列表/创建/删除 + 文件上传进度 + packages/data/ kb schema。

---

## 2. 功能描述

### 2.1 KB API

```typescript
// api/knowledge-base.ts
export const getKbList = (params: { page: number; pageSize: number }) =>
  alovaInstance.Get('/kb', { params })

export const getKbDetail = (id: string) =>
  alovaInstance.Get(`/kb/${id}`)

export const createKb = (data: CreateKbDTO) =>
  alovaInstance.Post('/kb', data)

export const deleteKb = (id: string) =>
  alovaInstance.Delete(`/kb/${id}`)

export const uploadFile = (kbId: string, file: File) =>
  alovaInstance.Post('/kb/upload', { kbId, file }, { enableUpload: true })
```

### 2.2 页面功能

| 功能 | 实现方式 |
|------|----------|
| KB 列表 | `useRequest` GET /kb，表格/卡片视图 |
| KB 创建 | Dialog + `useForm` + alova POST /kb |
| KB 删除 | 确认 Dialog + `useRequest.send()` DELETE /kb |
| 文件上传 | `useUploader` + 进度条 |
| KB 详情 | 路由 `/app/kb/$kbId`，基本信息和文档列表 |
| 空状态 | "暂无知识库，点击创建" |

### 2.3 packages/data/ kb schema

```typescript
export const createKbSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

export const kbSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  documentCount: z.number(),
  createdAt: z.string(),
})
```

---

## 3. 验收标准

| AC | 验收项 |
|----|--------|
| AC-01 | api/knowledge-base.ts CRUD + upload 方法 |
| AC-02 | packages/data kb schema 已提取 |
| AC-03 | KB 列表页（含空状态） |
| AC-04 | KB 创建 Dialog + useForm |
| AC-05 | KB 删除确认 + 刷新 |
| AC-06 | 文件上传 useUploader + 进度 |
| AC-07 | KB 详情页 |

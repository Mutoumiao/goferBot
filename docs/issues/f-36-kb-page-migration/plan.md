---
id: f-36
issue: issue.md
version: 1
---

# 知识库页面迁移 实现计划

**目标：** 迁移 KnowledgeBasePage — KB CRUD + 文件上传 + useUploader

**技术栈：** alova `useRequest` + `useForm` + `useUploader`

**PRD 引用：** §5.3 P1

---

## ADR 合规声明

| ADR | 涉及内容 | 符合 |
|-----|---------|------|
| ADR 0001 | 依赖引入 | ✅ 无新增禁止依赖 |

---

## 任务列表

### 任务 1: 提取 kb Zod schema
- [ ] RED → GREEN：`packages/data/src/schemas/kb.schema.ts`

### 任务 2: 创建 api/knowledge-base.ts
- [ ] RED → GREEN：CRUD + upload 方法

### 任务 3: KB 列表页 + 空状态
- [ ] RED → GREEN：`useRequest` GET /kb，loading/empty/error 三态

### 任务 4: KB 创建 Dialog
- [ ] RED → GREEN：`useForm` + openDialog

### 任务 5: KB 删除确认 + 文件上传
- [ ] RED → GREEN：确认 Dialog + useUploader

### 任务 6: KB 详情页
- [ ] RED → GREEN：路由 `/app/kb/$kbId`

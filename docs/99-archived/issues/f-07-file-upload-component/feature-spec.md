---
issue_id: f-07-file-upload-component
type: feature-spec
status: approved
summary: 提供文件上传组件，支持点击选择/拖拽上传、多文件、类型过滤（MD/TXT/PDF）、大小校验（>50MB 前端拦截）、进度显示、上传确认与取消。范围外排除 Presigned URL 和大文件分片。
---
# 功能规格：文件上传组件

> 对应 issue: `f-07-file-upload-component`
> 依赖: `b-02-knowledge-base-crud-api`（已完成）, `f-06-knowledge-base-file-manager`（进行中）

---

## 用户故事

作为知识库用户，我希望将本地文件上传到知识库，以便后续进行 RAG 检索和问答。

## 边界

- 范围内：
  - 点击上传按钮选择文件
  - 支持多文件选择
  - 文件类型过滤（Markdown、TXT、PDF）
  - 文件大小校验（前端拦截 > 50MB）
  - 上传进度显示
  - 上传前文件列表确认
  - 上传失败错误提示和重试
  - 拖拽上传
  - 上传取消
- 范围外：
  - Presigned URL 上传（Phase 6 优化）
  - 大文件分片上传
  - 上传速度限制
  - 文件夹上传

## 涉及页面/组件

- `FileUpload.vue` — 上传组件（按钮 + 对话框）
- `FileUploadDialog.vue` — 上传确认对话框（文件列表 + 进度）
- `useFileStore` — 上传状态管理

## 相关功能

- `f-06-knowledge-base-file-manager` — 显示上传后的文件
- `b-02-knowledge-base-crud-api` — 提供上传 API
- `i-11-minio-service` — 提供对象存储

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 前端直传后端 | 简化架构，Phase 6 再考虑 Presigned URL | 是 |
| 限制 50MB | 防止浏览器内存溢出，大文件后续分片 | 是 |
| 支持 md/txt/pdf | 首批支持的解析格式，后续扩展 | 是 |

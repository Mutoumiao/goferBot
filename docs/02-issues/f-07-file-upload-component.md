状态: needs-triage
分类: enhancement

## 要构建的内容

实现文件上传组件，支持选择文件、上传到 MinIO、显示上传进度和文档状态。

## 规格引用

- 功能规格: docs/03-specs/features/file-upload/feature-spec.md
- 行为规格: docs/03-specs/features/file-upload/behavior-spec.md
- API 规格: docs/03-specs/features/file-upload/api-spec.md

## 验收标准

- [ ] `packages/webui/src/components/knowledge-base/FileUpload.vue` 实现上传组件
- [ ] 点击"添加文件"按钮打开文件选择对话框
- [ ] 支持选择多个文件（多选）
- [ ] 支持文件类型过滤（Markdown、TXT、PDF 等）
- [ ] 文件名特殊字符校验（拒绝路径穿越字符 `../`、`..\\` 及不可打印字符）
- [ ] 文件大小前后端双重大小校验（前端拦截 > 50MB + 后端返回 413）
- [ ] 上传前显示文件列表（文件名、大小）
- [ ] 显示上传进度条（百分比）
- [ ] 上传完成后文件出现在文件管理器中
- [ ] 上传失败显示错误信息，支持重试
- [ ] 支持拖拽上传（拖拽文件到文件管理器区域）
- [ ] 上传过程中可取消
- [ ] 文档状态自动更新（uploaded → parsing → chunking → indexing → ready）
- [ ] 使用 Pinia Store 管理上传状态

## 阻塞于

- b-02-knowledge-base-crud-api（需要文档上传 API）
- i-03-minio-client（需要 MinIO 服务）
- f-06-knowledge-base-file-manager（需要文件管理器显示上传结果）

## 范围外

- Presigned URL 上传（Phase 6 优化）
- 大文件分片上传
- 上传速度限制

## Agent 简报

**分类：** enhancement
**摘要：** 文件上传组件，支持多选、进度显示、拖拽上传

**当前行为：**
前端无文件上传功能。

**期望行为：**
用户可选择文件上传到知识库，实时查看上传进度和文档处理状态。

**关键接口：**
- `packages/webui/src/components/knowledge-base/FileUpload.vue` — 上传组件
- API: `POST /api/knowledge-bases/:id/documents`
- Pinia Store — 上传状态管理

**验收标准：**
- [ ] 文件选择对话框
- [ ] 支持多选
- [ ] 文件类型过滤
- [ ] 上传前文件列表
- [ ] 上传进度条
- [ ] 上传完成显示在文件管理器
- [ ] 上传失败 + 重试
- [ ] 支持拖拽上传
- [ ] 上传可取消
- [ ] 文档状态自动更新
- [ ] Pinia Store 管理状态

**范围外：**
- Presigned URL 上传
- 大文件分片
- 速度限制

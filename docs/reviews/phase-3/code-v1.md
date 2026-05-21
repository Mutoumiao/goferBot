---
scope: phase-3
type: code
date: 2026-05-17
issues: [f-05, f-06, f-07, f-08, b-02]
status: completed
summary: Phase 3 代码审查，覆盖文件管理器、上传组件、文件夹管理三个前端组件和相关后端 API。发现 Critical 0、Major 2（文件上传绕过 API 客户端、上传文件内存校验）、Minor 3、Info 2，总体结论有条件通过。
---

# Phase 3 代码审查报告

> **审查类型**：代码审查 + Spec 对齐审查 + 安全审查
> **审查对象**：f-06 / f-07 / f-08（文件管理器、上传组件、文件夹管理）
> **审查日期**：2026-05-17
> **总体结论**：有条件通过
> **问题统计**：Critical 0 | Major 2 | Minor 3 | Info 2

---

## 发现的问题

### Major

1. **文件上传未使用 API 客户端，直接构造 URL**
   - 位置：`FileUpload.vue:171`
   - 详情：`uploadWithProgress` 直接使用 `XMLHttpRequest` 拼接 URL 和读取 `localStorage` token，绕过统一的 `api/client.ts`。这导致：1) 请求/响应拦截器不生效；2) 401 自动刷新逻辑不生效；3) baseURL 配置逻辑重复。
   - 建议：扩展 `api/client.ts` 添加 `uploadFile(path, formData, onProgress)` 方法，或至少复用 `baseURL` 和 token 获取逻辑。

2. **上传文件完全加载到内存后再校验大小**
   - 位置：`document.controller.ts:90-94`
   - 详情：`for await...of` 读取所有 chunks 到内存后再检查 `buffer.length > 50MB`。Fastify 的 `@fastify/multipart` 已在 `bootstrap.ts` 配置了 `fileSize: 50 * 1024 * 1024` 限制，但控制器仍做二次校验。问题在于：如果文件刚好略超 50MB，已经在内存中分配了完整 Buffer。
   - 建议：依赖 Fastify 的 multipart limit 作为第一道防线（流式），控制器的二次校验保留但改为流式累计大小，避免 `Buffer.concat`。

### Minor

3. **`allDone` 计算属性在上传完成后未触发自动关闭（部分失败场景）**
   - 位置：`FileUpload.vue:134-140`
   - 详情：当部分文件上传失败时，`allDone` 为 false，对话框不会自动关闭。当前行为可接受（全部成功才关闭），但建议补充注释说明。

4. **右键菜单位置可能超出视口**
   - 位置：`FileManager.vue:394-399`
   - 详情：`contextMenuPos` 直接使用 `e.clientX/e.clientY`，当用户在屏幕右侧或底部右键时，菜单会超出视口。
   - 建议：添加边界检测，限制 `left + menuWidth <= window.innerWidth`。

5. **`addFiles` 中校验逻辑有覆盖问题**
   - 位置：`FileUpload.vue:74-88`
   - 详情：当文件大小超过 50MB 时设置 `status = 'error'`，但后续仍继续执行 ext 和文件名校验。虽然不影响结果，但逻辑上应提前 `continue`。

### Info

6. **Document 状态自动更新机制未实现**
   - 位置：f-07 issue 验收标准
   - 详情：issue 要求"文档状态自动更新（uploaded → parsing → chunking → indexing → ready）"，当前仅创建 `status: 'uploaded'` 的记录，无后续状态流转。这依赖于 Phase 5 的 RAG 流水线。

7. **空文件夹状态提示未实现**
   - 位置：f-08 issue 验收标准
   - 详情：issue 要求"文件夹空状态：提示'空文件夹'"，当前空状态统一显示"点击添加文件导入文档"，未区分"空文件夹"和"知识库为空"的场景。

---

## Spec 对齐检查

### f-06 知识库文件管理器

| 验收标准 | 状态 | 证据 |
|----------|------|------|
| FileManager.vue 实现右侧文件管理器 | ✅ | FileManager.vue |
| 图标视图显示文件和文件夹 | ✅ | FileGridItem.vue |
| 文件项显示状态标签 | ✅ | FileGridItem.vue:70-76 |
| 双击文件夹进入下一级 | ✅ | FileManager.vue:111-114 |
| 面包屑导航 | ✅ | BreadcrumbNav.vue |
| 顶部工具栏（搜索、排序） | ✅ | FileManager.vue:266-311 |
| 空状态提示 | ✅ | FileManager.vue:350-374 |
| 右键菜单操作 | ✅ | FileManager.vue:393-437 |
| 支持多选（Ctrl/Cmd + 点击） | ✅ | FileGridItem.vue:47-53 |
| 加载骨架屏 | ✅ | FileManager.vue:326-332 |
| 错误状态 + 重试 | ✅ | FileManager.vue:334-348 |
| 状态标签颜色正确 | ✅ | FileGridItem.vue:20-28 |

### f-07 文件上传组件

| 验收标准 | 状态 | 证据 |
|----------|------|------|
| FileUpload.vue 实现上传组件 | ✅ | FileUpload.vue |
| 点击"添加文件"打开文件选择 | ✅ | FileManager.vue:295-302 |
| 支持多选 | ✅ | FileUpload.vue:212 |
| 文件类型过滤 | ✅ | FileUpload.vue:213, 78-83 |
| 文件名特殊字符校验 | ✅ | FileUpload.vue:84-87, document.controller.ts:18-35 |
| 文件大小前后端双重校验 | ✅ | FileUpload.vue:74-76, document.controller.ts:96-101 |
| 上传前显示文件列表 | ✅ | FileUpload.vue:220-260 |
| 上传进度条 | ✅ | FileUpload.vue:234-242 |
| 上传完成后文件出现在管理器 | ✅ | FileUpload.vue:134-140 + onUploaded |
| 上传失败显示错误 + 重试 | ✅ | FileUpload.vue:245-248, 127-129 |
| 支持拖拽上传 | ✅ | FileManager.vue:241-255 |
| 上传过程中可取消 | ⚠️ | 对话框可关闭，但无取消进行中的 XHR |
| 文档状态自动更新 | ❌ | 依赖 Phase 5 RAG 流水线 |
| Pinia Store 管理上传状态 | ⚠️ | 状态在 FileUpload 组件内管理，非 Pinia |

### f-08 文件夹管理

| 验收标准 | 状态 | 证据 |
|----------|------|------|
| 创建新文件夹 | ✅ | FileManager.vue:439-472 |
| 创建对话框输入名称 | ✅ | FileManager.vue:446-453 |
| 重命名文件夹 | ✅ | FileManager.vue:474-507 |
| 删除文件夹（确认对话框） | ✅ | FileManager.vue:509-536 |
| 移动文件到不同文件夹 | ❌ | 未实现 |
| 移动文件夹（拖拽调整层级） | ❌ | 未实现 |
| 文件夹空状态提示 | ⚠️ | 未区分"空文件夹"场景 |
| 操作后自动刷新 | ✅ | confirmCreateFolder/confirmRename/confirmDelete |
| 操作成功/失败 Toast 提示 | ❌ | 使用对话框内错误提示，无 Toast |
| Pinia Store 管理状态 | ✅ | file.ts:85-98 |

---

## 修复建议优先级

**建议本次修复：**
- Major-1：统一上传请求走 API 客户端（或至少复用 baseURL/token 逻辑）
- Major-2：上传大小校验改为流式累计

**建议后续迭代：**
- Minor-2：右键菜单位置边界检测
- Info-1/2：文档状态流转、空文件夹提示（依赖其他 Phase）

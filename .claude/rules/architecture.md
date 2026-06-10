---
name: web-package-rules
description: packages/web/ 编码规范
globs:
  - "packages/web/**"
---

> 这个项目如何理解业务、如何拆分代码、什么时候创建组件、什么时候创建 Store、什么时候创建 Service。

# Frontend Architecture Rules (Feature First)

## 核心原则

本项目采用：

```txt
Feature First Architecture
```

而不是：

```txt
Page First Architecture
```

也不是：

```txt
Technical First Architecture
```

---

错误思维：

```txt
Header
Sidebar
Main
Content
```

这是页面布局思维。

---

正确思维：

```txt
KnowledgeBase
FolderTree
FileManager
ChatSession
KnowledgeBaseToolbar
```

这是业务领域思维。

---

开发时必须优先思考：

```txt
这个功能属于哪个业务？
```

而不是：

```txt
这个组件放页面哪个区域？
```

---

## 目录结构规范

```txt
src/
├── routes/
│
├── stores/
│   ├── auth.ts
│   ├── settings.ts
│   └── app.ts
│
├── features/
│   ├── kb/
│   │   ├── store.ts
│   │   ├── services.ts
│   │   ├── types.ts
│   │   ├── hooks.ts
│   │   └── components/
│   │
│   ├── chat/
│   ├── file/
│   └── auth/
│
├── shared/
│
├── components/
├── hooks/
├── utils/
└── types/
```

---

## 路由层职责

路由层仅负责：

```txt
URL
权限控制
页面入口
```

例如：

```tsx
export const Route = createFileRoute('/app/kb')({
  component: KnowledgeBasePage,
})
```

禁止：

```txt
复杂业务逻辑
业务状态管理
业务流程编排
```

---

## Feature 拆分原则

每个 Feature 表示一个独立业务领域。

例如：

```txt
features/kb
features/chat
features/file
features/auth
```

---

不要按照页面拆分：

```txt
Header
Sidebar
Main
```

---

应按照业务拆分：

```txt
KnowledgeBaseToolbar
FolderTree
FileManager
ChatSession
```

---

判断标准：

如果当前页面被删除。

该组件是否仍然有业务意义？

例如：

```txt
Header
Sidebar
Main
```

没有意义。

---

例如：

```txt
FolderTree
FileManager
KnowledgeBaseToolbar
```

仍然有业务意义。

应优先选择业务命名。

---

## API 规则

packages/web/src/api

职责：

```txt
只负责 HTTP 请求，与后端类型对接
```

示例：

```ts
export const getKbList = () => ...
export const createKb = () => ...
export const deleteKb = () => ...
```

---

禁止：

```txt
Toast
Store更新
页面跳转
缓存刷新
```

API 只能访问服务端。

---

## Store 规则

Store 只负责保存状态。

Store 是：

```txt
状态拥有者
```

不是：

```txt
业务逻辑层
```

---

允许：

```txt
currentKbId
currentFolderId
selectedFileIds
searchKeyword
theme
language
```

---

禁止：

```txt
createKnowledgeBase()
deleteKnowledgeBase()
uploadFiles()
sendMessage()
```

这些属于业务流程。

不属于状态。

---

Store 命名：

```ts
useKbStore
useChatStore
useFileStore
useAuthStore
```

统一采用：

```txt
useXxxStore
```

格式。

---

## Service 规则

Service 负责：

```txt
业务动作
业务流程
业务编排
```

例如：

```txt
创建知识库
删除知识库
上传文件
移动文件
开始聊天
删除会话
```

---

示例：

```ts
export async function removeKnowledgeBase() {}
```

---

Service 内部允许：

```txt
调用 API
更新 Store
刷新 Query Cache
Toast 提示
日志记录
```

---

组件应调用：

```ts
removeKnowledgeBase()
```

而不是自行组合多个业务步骤。

---

## Component 规则

组件职责：

```txt
展示 UI
处理交互
触发业务动作
```

---

推荐：

```tsx
<Button
  onClick={() => removeKnowledgeBase(id)}
>
```

---

避免：

```tsx
<Button
  onClick={async () => {
    await deleteKb()
    await refresh()
    await updateStore()
    toast.success()
  }}
>
```

组件不应承担业务编排职责。

---

## Feature Store 与 Global Store

### Global Store

放在：

```txt
src/stores
```

仅允许存放：

```txt
Auth
Settings
Theme
Language
App
Tabs
```

这些属于整个应用。

---

例如：

```txt
stores/auth.ts
stores/settings.ts
stores/app.ts
```

---

### Feature Store

放在：

```txt
features/kb/store.ts
features/chat/store.ts
```

仅存放该业务领域状态。

例如：

```txt
当前知识库
当前文件夹
当前聊天会话
```

---

## 组件命名规范

禁止：

```txt
Header
Main
Sidebar
Content
Panel
```

除非组件确实只是纯布局容器。

---

推荐：

```txt
KnowledgeBaseToolbar
FolderTree
FileManager
FileUploader
ChatSessionList
ChatMessageList
KnowledgeBaseSelector
```

名称必须体现业务含义。

---

## Page 组件规则

Page 的职责：

```txt
组装业务组件
连接状态
协调页面布局
```

---

Page 不负责：

```txt
复杂业务流程
大量业务事件
重复业务逻辑
```

---

如果出现：

```txt
handleCreateKb
handleDeleteKb
handleUploadFile
handleMoveFile
handleRenameFolder
```

大量堆积在 Page 中。

说明业务逻辑应该迁移到 Service。

---

## 什么时候创建 Service

满足以下任意条件：

### 条件1

业务逻辑被多个组件复用

例如：

```txt
Toolbar
ContextMenu
FileList
```

都需要删除知识库。

---

### 条件2

一个操作包含多个步骤

例如：

```txt
删除知识库
↓
删除索引
↓
刷新缓存
↓
更新状态
↓
提示成功
```

---

### 条件3

组件内出现大量 async 流程

例如：

```tsx
onClick={async () => {
  ...
}}
```

超过 20 行。

应迁移至 Service。

---

## 什么时候拆分 Store

单个 Store 超过：

```txt
300 ~ 500 行
```

开始考虑拆分。

例如：

```txt
store/
├── selection.ts
├── search.ts
├── dialog.ts
└── index.ts
```

---

不要提前拆分。

优先保持简单。

---

## 架构目标

目标不是：

```txt
文件数量最多
目录层级最多
抽象层最多
```

---

目标是：

```txt
业务边界清晰
状态归属明确
代码职责单一
修改成本可控
```

---

开发时优先问自己：

```txt
这个业务属于谁？
```

而不是：

```txt
这个组件放哪里？
```

这是本项目最重要的架构原则。

最高优先级规则：

> 当新增功能时，优先判断它属于哪个 Feature（kb/chat/file/auth），然后在该 Feature 内完成开发。除非是全局能力（auth、theme、settings、tabs、app），否则不要直接创建新的全局 store、全局 hook、全局 utils。这样可以避免业务代码逐渐扩散到整个项目。

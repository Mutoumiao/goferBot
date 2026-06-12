---
name: web-architecture
description: packages/web 架构原则 — Feature First 与职责边界
globs:
  - "packages/web/**"
---

# Frontend Architecture (Feature First)

## 核心原则

按**业务领域**拆分，不是按页面布局拆分。

```txt
❌ 错误 — 页面布局思维（删除页面后无意义）：
Header / Sidebar / Main / Content

✅ 正确 — 业务领域思维（删除页面后仍有意义）：
KnowledgeBase / FolderTree / FileManager / ChatSession
```

开发时优先问：**这个功能属于哪个业务？** 不是：这个组件放页面哪个区域？

## 目录结构

```txt
src/
├── routes/          # URL + 权限 + 页面入口。禁止业务逻辑/状态管理/流程编排
├── features/        # 按业务领域拆分（kb / chat / file / auth）
│   └── {feature}/
│       ├── store.ts       # 该领域状态（currentKbId / selectedFileIds）
│       ├── services.ts    # 业务动作（createKnowledgeBase / uploadFiles）
│       ├── types.ts       # 该领域类型
│       ├── hooks.ts       # 该领域自定义 hooks
│       └── components/    # 该领域组件（KnowledgeBaseToolbar / FolderTree）
├── stores/          # 全局状态：auth / settings / theme / app / tabs
├── api/             # HTTP 请求，只对接后端。禁止 Toast / Store 更新 / 跳转
├── utils/           # 纯函数/基础设施（server.ts / llm-config.ts / cn.ts）
└── components/      # 跨 feature 复用的视图组件（禁止 barrel 文件）
```

### features/ 模块内部规范

每个 feature 是一个独立业务领域，内部结构：

```txt
features/chat/
├── store.ts              # 状态拥有者：currentKbId / currentFolderId / selectedFileIds
├── services.ts           # 业务编排：removeKnowledgeBase() = API → 刷新 → 更新状态 → Toast
├── types.ts              # KB 相关类型定义
├── hooks.ts              # useKbSelection / useKbOperations
└── components/
    ├── KnowledgeBaseToolbar.tsx
    ├── FolderTree.tsx
    └── FileManager.tsx
```

**规则**：
- `store.ts` 只存状态，不存业务逻辑（禁止 `createKb()` / `deleteKb()`）
- `services.ts` 负责业务动作，允许调用 API、更新 Store、Toast 提示
- 组件通过 `services.ts` 触发业务，不自编 async 流程

## 职责边界

| 层级          | 职责               | 示例                                      | 禁止                    |
|---------------|--------------------|-------------------------------------------|-------------------------|
| **API**       | HTTP 请求          | `alovaInstance.Get('/kb')`                | Toast、Store 更新、跳转 |
| **Store**     | 保存状态           | `currentKbId: string`                     | `createKnowledgeBase()` |
| **Service**   | 业务编排           | `removeKnowledgeBase()`                   | —                       |
| **Component** | 展示 UI、触发动作  | `<Button onClick={removeKnowledgeBase}>`  | async 组合超过 3 步     |
| **Page**      | 组装组件、连接状态 | `KbPage = <KbToolbar /> + <FolderTree />` | 复杂业务流程            |

## 决策标准

**创建 Service**（满足任一）：
1. 逻辑被多个组件复用（Toolbar / ContextMenu / FileList 都要删除知识库）
2. 一个操作包含多个步骤：API → 刷新缓存 → 更新状态 → Toast
3. 组件内 async 流程超过 20 行

**拆分 Store**：单个 Store 超过 300~500 行

**组件命名**：体现业务含义，如 `KnowledgeBaseToolbar`、`FolderTree`。禁止 `Header`、`Sidebar`（除非纯布局容器）。

## 最高优先级规则

> 新增功能时，优先判断属于哪个 Feature（kb / chat / file / auth），然后在该 Feature 内完成开发。除非全局能力（auth / theme / settings / tabs / app），否则禁止直接创建新的全局 store / hook / util。

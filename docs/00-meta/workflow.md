# 开发流程

> 本文档定义知识库项目的标准开发流程。
>
> 核心原则：**契约先行、分批执行、双轨并行、质量内建。**

---

## 阶段 0: PRD 稳定化

**输入**：头脑风暴产物、谈话记录、大 PRD 草案  
**输出**：稳定的 PRD + 功能批次划分

**为什么必须先稳定 PRD**：
- 未经边界定义的 PRD → issue 拆出来还是粗的
- 一次生成太多 spec → spec 质量低，交互状态漏掉
- 中途发现 PRD 不合理 → 已生成的 plan/spec/issue 全作废

**操作**：
1. 从 PRD 中提取确定要做的功能清单
2. 标记优先级（P0/P1/P2）
3. 明确本期不做的东西（防止范围蔓延）
4. **划分批次**：每批 1~3 个相关功能

```markdown
## 功能批次

| 批次 | 功能 | 优先级 | 状态 |
|------|------|--------|------|
| 01 | 登录/注册 | P0 | 待启动 |
| 02 | 知识库列表 | P0 | 待启动 |
| 03 | 文件上传 | P1 | 待启动 |
```

**原则**：一批不超过 3 个相关功能，确保 spec-validator 能深入每个交互状态。

---

## 阶段 1: Issue 拆分

**输入**：PRD 中当前批次的功能描述  
**输出**：`docs/02-issues/` 下的双轨 issue

**使用 skill**：`/issue-generator`

**双轨前缀：**
- `f-XX`: 前端功能
- `b-XX`: 后端接口
- `d-XX`: 设计
- `i-XX`: 基础设施
- `q-XX`: 质量

**规则**：
- 每个功能拆成 f-XX + b-XX 两个独立 issue
- 极简单功能（纯 UI 无 API）可只拆 f-XX
- 纯后端功能（如数据库迁移）可只拆 b-XX
- 按依赖顺序发布（阻塞者先发布）

---

## 阶段 2: 契约编写（Spec）

**输入**：Issue 文件 + PRD 相关章节  
**输出**：`docs/03-specs/features/{feature-slug}/` 下的三层 spec

**使用 skill**：`/spec-validator`

**三层规格**：
1. **功能规格** (`feature-spec.md`)：用户故事、边界、涉及页面
2. **行为规格** (`behavior-spec.md`)：前端交互状态表格（loading/empty/error/success/partial）
3. **API 规格** (`api-spec.md`)：后端接口契约（路由、DTO、错误码）

**关键规则**：
- 一次只处理一个 issue 的 spec
- 交互状态必须具体到"按钮是否禁用"、"显示什么颜色"
- 发现术语冲突立即解决，不留到编码阶段
- 可辅助使用 gstack `/grill-with-docs` 挑战术语精确性

---

## 阶段 3: 执行计划

**输入**：Issue + Spec  
**输出**：`docs/04-plans/{issue-slug}/YYYY-MM-DD.md`

**使用 skill**：`/plan-generator`

**规则**：
- 每个步骤 2~5 分钟
- 禁止占位符（"TODO"、"稍后实现"）
- 必须包含具体代码示例和验证命令
- 自检：是否覆盖了 spec 中所有交互状态/端点？

---

## 阶段 4: 并行开发

**输入**：Plan + Spec  
**输出**：可运行的代码

**使用 skill**：`/dev-orchestrator`

**前端 Agent**：
- 读行为规格 → 生成计划 → 编码 → `/kb-review`
- 若后端 API 未完成，先用 Mock 数据，标记 `TODO: 联调`
- 编码后可用 `/kb-review` 做代码审查与 spec 对齐
- 页面可访问后可用 `/gstack-design-review` 做视觉审计

**后端 Agent**：
- 读 API 规格 → 生成计划 → 编码 → `/kb-review`
- 编码后可用 `/kb-review` 做代码审查与安全检查

**测试**：
- 使用 gstack `/tdd` 遵循 red-green-refactor 循环
- 每完成一个任务运行测试，不要攒到最后
- 频繁提交（每个任务一个 commit）

---

## 阶段 5: 联调整合与审查

**输入**：前后端代码  
**输出**：通过端到端测试的完整功能

**使用 skill**：`/kb-review`

**操作**：
1. 前端移除 Mock，对接真实 API
2. 运行端到端测试（Playwright）
3. 使用 `/kb-review` 执行 Spec 对齐审查：
   - 验证交互状态是否按 behavior-spec 实现
   - 验证 API 是否按 api-spec 返回正确错误码
   - 验证安全基线是否满足
4. 审查记录归档到 `docs/07-reviews/`

**问题处理**：
- 前端问题 → 回到阶段 4 修复 f-XX
- 后端问题 → 回到阶段 4 修复 b-XX
- spec 问题 → 回到阶段 2 更新 spec（允许回溯）

---

## 阶段 6: 关闭与归档

**输入**：已验证的代码  
**输出**：关闭的 issue + 更新的进度

**使用 skill**：`/issue-lifecycle` + `/kb-review`

**操作**：
1. 使用 `/kb-review` 执行关闭前验收：
   - 确认所有 Critical/Major 问题已修复
   - 确认测试通过、类型检查通过
   - 确认审查记录已归档到 `docs/07-reviews/`
2. 更新 issue 状态为 `closed`
3. 勾选验收标准 `[x]`
4. 更新 `PROGRESS.md` 进度
5. 可选：归档到 `docs/99-archived/`

**然后**：回到阶段 1，启动下一批功能。

---

## 文档依赖链

```
01-prd/ → 02-issues/ → 03-specs/ → 04-plans/ → 代码 → 07-reviews/ → 08-test-cases/
   ↑___________________________________________|
              （发现 spec 不足时回溯更新）
```

---

## 命名规范

- Issue: `{prefix}-{NN}-{kebab-case-slug}.md`
- Plan: `YYYY-MM-DD.md`（放在 `04-plans/{issue-slug}/` 下）
- Spec: 固定为 `feature-spec.md`, `behavior-spec.md`, `api-spec.md`
- Review: `{type}-review-YYYY-MM-DD.md`

---

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 跳过 spec 直接写 plan | plan 太粗，交互不符预期 | 必须先写 behavior-spec |
| 一次拆完 PRD 所有 issue | issue 质量低，后期大量返工 | 按批次拆分，做完一批再拆下一批 |
| 一个 issue 包含前后端 | 无法并行，plan 臃肿 | 拆成 f-XX + b-XX |
| plan 里写 "TODO" | 工程师不知道怎么做 | 每个步骤给具体代码和命令 |
| 前后端不联调直接关闭 | 接口不匹配 | 必须联调验证后再关闭 |
| 发现 spec 错了硬改代码 | 代码和文档脱节 | 回溯更新 spec，再改代码 |
| 审查后不保存记录 | 重复犯同样错误 | 必须归档到 `docs/07-reviews/` |
| 安全问题不分级 | 阻塞与非阻塞问题混淆 | 使用 `/kb-review` 四级分类 |
| 混淆设计审查与代码审查 | 视觉问题被代码审查遗漏 | 视觉审计用 `/gstack-design-review`，代码审查用 `/kb-review` |

---

*以下为原始工作流优化计划的完整内容，供参考：*


---

## 一、当前问题诊断

### 1.1 上下文污染

| 现象 | 原因 |
|------|------|
| Agent 引用旧 issue/plan | `.scratch/` 和 `docs/superpowers/plans/` 历史文件过多 |
| 生成代码风格不一致 | 同一 Agent 同时处理前后端，上下文切换混乱 |
| 测试用例过时 | 旧测试基于 V1 架构，Agent 误参考 |

### 1.2 单 Agent 瓶颈

```
单 Agent 模式：
[用户] → [Agent A] → 处理前端 → 处理后端 → 处理测试 → 循环修复
              ↑
         上下文爆炸，效率低
```

### 1.3 缺乏行为契约

- 无前端交互规格 → Agent 凭猜测实现 UI
- 无后端 API 规格 → 前后端接口不匹配
- 无边界定义 → 反复修改同一功能

---

## 二、优化方案：双轨并行 + 契约驱动

### 2.1 核心原则

```
契约先行 → 前后端分离 → 并行实现 → 联调验证
```

### 2.2 文档分层

```
docs/
├── specs/
│   ├── frontend-behavior-spec.md      # 前端行为契约（交互、状态、边界）
│   ├── backend-api-spec.md            # 后端 API 契约（路由、DTO、错误码）
│   └── data-model-spec.md             # 数据模型契约（Drizzle Schema、Milvus）
├── issues/
│   ├── frontend/                      # 前端 Issue（独立、可并行）
│   └── backend/                       # 后端 Issue（独立、可并行）
└── plans/
    ├── phase-1-infrastructure.md      # 基础设施计划
    ├── phase-2-auth.md                # 认证系统计划
    └── ...
```

### 2.3 Agent 角色定义

| Agent 角色 | 职责 | 输入 | 输出 |
|-----------|------|------|------|
| **架构师** | 编写/维护规格、ADR、数据模型 | 用户需求 | 规格文档、Schema 定义 |
| **前端 Agent** | Vue 组件、Pinia Store、UI 交互 | 前端行为规格 + 后端 API 规格 | 组件代码、测试 |
| **后端 Agent** | Hono 路由、Service、数据库操作 | 后端 API 规格 + 数据模型规格 | API 实现、测试 |
| **DevOps Agent** | Docker、配置、部署脚本 | 架构规格 | docker-compose、CI 配置 |
| **验收 Agent** | 联调测试、端到端验证 | 前后端代码 + 规格 | 测试报告、Bug 列表 |

### 2.4 工作流

```
Phase 0: 契约编写（架构师 Agent）
    ├── 前端行为规格
    ├── 后端 API 规格
    └── 数据模型规格
            ↓
Phase 1: 并行实现
    ├── [前端 Agent] → 登录页 / 知识库页 / 聊天页
    └── [后端 Agent] → Docker / PG / MinIO / Milvus / Redis / API
            ↓
Phase 2: 联调整合（验收 Agent）
    ├── 接口对接
    ├── 端到端测试
    └── Bug 修复（分发回前后端 Agent）
```

---

## 三、前端行为规格模板

### 3.1 页面：知识库管理

```markdown
## 页面：KnowledgeBaseManager

### 入口
- 路由：/knowledge-bases
- 触发：点击左侧边栏文件夹图标

### 初始状态
- 左侧：知识库列表（按 sort_order 排序，置顶项在前）
- 右侧：空状态提示"请选择或创建知识库"

### 交互行为

#### 创建知识库
- 触发：点击"新建"按钮
- 输入：知识库名称（1-50 字符，必填）
- 确认：Enter 或点击"创建"
- 取消：Esc 或点击"取消"
- 成功：新项插入列表顶部，自动选中，右侧进入文件视图
- 失败：名称重复时提示"知识库名称已存在"

#### 切换知识库
- 触发：点击列表项
- 行为：高亮选中项，右侧加载该知识库文件列表
- 加载态：右侧显示 Skeleton
- 错误态：加载失败显示重试按钮

#### 文件上传
- 触发：点击"添加文件"或拖拽文件到右侧区域
- 支持格式：.md, .txt, .pdf, .docx（MVP 先支持 .md, .txt）
- 大小限制：单文件 50MB
- 多选：支持
- 上传中：显示进度条，文件项 status = uploaded（灰色）
- 上传后：自动触发索引，status 流转 parsing → chunking → indexing → ready
- 失败：status = failed，hover 显示 errorMessage

### 边界条件
- 空知识库：右侧显示空状态插画
- 无权限：跳转登录页
- 网络断开：Toast 提示"网络异常，已切换离线模式"
```

### 3.2 页面：聊天对话

```markdown
## 页面：ChatSession

### 入口
- 路由：/chat/:sessionId
- 触发：点击左侧边栏消息图标 / 顶部标签栏 + 按钮

### 初始状态
- 空会话：中间大输入框 + 快捷提问胶囊
- 已有会话：消息流（倒序加载，滚动到底部）

### 交互行为

#### 发送消息
- 触发：输入框按 Enter（Shift+Enter 换行）
- 输入限制：1-4000 字符
- 空输入：按钮 disabled
- 发送中：输入框 disabled，显示"发送中..."
- 成功：用户消息追加到流，AI 消息 SSE 流式接收
- 失败：Toast 提示，消息标记为失败（可重试）

#### @提及知识库
- 触发：输入框输入 @
- 行为：弹出知识库选择下拉（多选）
- 确认：Enter 或点击项
- 取消：Esc 或点击外部
- 选中后：输入框显示蓝色标签，消息关联 knowledgeBaseIds

#### 多知识库选择
- 位置：输入框上方工具栏
- 行为：复选框选择多个知识库
- 默认：全不选（直连 LLM，无 RAG）
- 提示：选中后显示"将基于 N 个知识库回答"

### 边界条件
- 会话不存在：跳转首页并 Toast 提示
- LLM 配置缺失：提示"请先配置 LLM 提供商"
- SSE 断开：自动重连 3 次，失败后提示"连接中断"
```

---

## 四、后端 API 规格模板

### 4.1 认证

```markdown
## POST /api/auth/sign-in/email

### 请求
```json
{
  "email": "string (email format, required)",
  "password": "string (8-128 chars, required)"
}
```

### 响应 200
```json
{
  "token": "string",
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string | null"
  }
}
```

### 错误码
- 400: 请求格式错误
- 401: 邮箱或密码错误
- 429: 登录过于频繁
```

### 4.2 知识库

```markdown
## GET /knowledge-bases

### 认证
Bearer Token (required)

### 响应 200
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "isPinned": "boolean",
      "sortOrder": "number",
      "icon": "string | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

## POST /knowledge-bases

### 请求
```json
{
  "name": "string (1-50 chars, required)"
}
```

### 响应 201
```json
{
  "id": "uuid",
  "name": "string",
  "isPinned": false,
  "sortOrder": 0,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### 错误码
- 400: 名称格式错误
- 409: 名称重复
- 401: 未认证
```

### 4.3 文档上传

```markdown
## POST /knowledge-bases/:id/documents

### 认证
Bearer Token (required)

### Content-Type
multipart/form-data

### 请求
- file: File (required, max 50MB)
- folderId: uuid (optional, default root)

### 响应 201
```json
{
  "id": "uuid",
  "name": "string",
  "status": "uploaded",
  "storageKey": "string",
  "createdAt": "ISO8601"
}
```

### 异步行为
- 返回 201 后立即触发 BullMQ parse job
- 客户端轮询 GET /documents/:id 获取 status 更新

### 错误码
- 400: 文件格式不支持
- 413: 文件过大
- 404: 知识库不存在
```

---

## 五、数据模型规格

```typescript
// 核心类型定义（前后端共享）

interface User {
  id: string;          // uuid
  email: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
}

interface KnowledgeBase {
  id: string;          // uuid
  userId: string;
  name: string;        // 1-50 chars
  description: string | null;
  isPinned: boolean;
  sortOrder: number;
  icon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Folder {
  id: string;          // uuid
  kbId: string;
  parentId: string | null;  // null = root
  name: string;
  createdAt: Date;
}

interface Document {
  id: string;          // uuid
  kbId: string;
  folderId: string | null;
  name: string;
  ext: string | null;
  mimeType: string | null;
  size: number;        // bytes
  storageKey: string;  // MinIO key
  hash: string | null;
  status: 'uploaded' | 'parsing' | 'chunking' | 'indexing' | 'ready' | 'failed';
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Chunk {
  id: string;          // uuid
  documentId: string;
  kbId: string;
  content: string;
  tokenCount: number | null;
  chunkIndex: number;
  milvusId: string | null;
  createdAt: Date;
}

interface Session {
  id: string;          // uuid
  userId: string;
  title: string;
  provider: string | null;
  model: string | null;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

interface Message {
  id: string;          // uuid
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  knowledgeBaseIds: string[] | null;
  createdAt: Date;
}
```

---

## 六、Issue 拆分示例

### 后端 Issues（可并行）

```
[B-01] Docker Compose 基础设施
  - PG + MinIO + Milvus + Redis 配置
  - 健康检查脚本
  - 接受标准：docker-compose up 后所有服务 Ready

[B-02] Drizzle ORM + 数据库迁移
  - Schema 定义
  - 迁移脚本
  - 种子数据
  - 接受标准：迁移成功，种子数据可查询

[B-03] MinIO Client 封装
  - 上传/下载/删除/预览 URL
  - 错误处理
  - 接受标准：单元测试通过

[B-04] Better Auth 集成
  - 登录/注册/登出 API
  - Session 中间件
  - 接受标准：curl 测试认证流程

[B-05] 知识库 CRUD API
  - POST /knowledge-bases
  - GET /knowledge-bases
  - PATCH /knowledge-bases/:id
  - DELETE /knowledge-bases/:id
  - 接受标准：Postman 集合测试通过

[B-06] 虚拟文件夹 CRUD API
  - POST /folders
  - GET /folders
  - PATCH /folders/:id
  - DELETE /folders/:id
  - 接受标准：支持嵌套层级

[B-07] 文档上传 API
  - multipart/form-data 接收
  - MinIO 存储
  - 创建 document 记录
  - 触发 BullMQ job
  - 接受标准：上传后可在 MinIO 看到文件

[B-08] 会话与消息 API
  - POST /sessions
  - GET /sessions
  - DELETE /sessions/:id
  - POST /chat (SSE)
  - 接受标准：SSE 流式输出正常
```

### 前端 Issues（可并行）

```
[F-01] 登录/注册页面
  - 登录表单（邮箱+密码）
  - 注册表单（邮箱+密码+确认密码）
  - 表单验证
  - 错误提示
  - 接受标准：可完成登录/注册流程

[F-02] 认证状态管理
  - Pinia auth store
  - Token 持久化
  - 路由守卫
  - 接受标准：未登录跳转登录页，已登录跳转首页

[F-03] 知识库列表页
  - 左侧知识库列表
  - 新建知识库弹窗
  - 置顶/排序
  - 接受标准：CRUD 操作正常

[F-04] 虚拟文件夹视图
  - 右侧文件资源管理器
  - 面包屑导航
  - 新建文件夹
  - 接受标准：支持多级目录

[F-05] 文件上传组件
  - 拖拽上传
  - 进度条
  - 状态标签（uploaded/parsing/.../ready/failed）
  - 接受标准：上传后状态正确流转

[F-06] 聊天会话页
  - 消息流渲染
  - 底部输入框
  - SSE 流式接收
  - Markdown 渲染
  - 接受标准：可完成一轮对话

[F-07] 多知识库选择
  - 输入框上方工具栏
  - 复选框选择
  - @提及下拉
  - 接受标准：选中后消息携带 kbIds

[F-08] 设置页迁移
  - LLM 提供商配置
  - Embedding 配置
  - 温度参数
  - 接受标准：配置可保存/读取
```

---

## 七、Agent 协作规则

### 7.1 输入约束

每个 Agent 启动时只读取：
- 自己的 Issue 文件
- 相关的 Spec 文件
- 必要的代码文件（不遍历整个仓库）

### 7.2 输出规范

- 代码变更必须通过测试
- 必须更新相关文档（如 API 变更同步到 Spec）
- 禁止修改不属于自己的文件

### 7.3 联调机制

```
前端 Agent 完成 F-05（文件上传组件）
    ↓
检查后端 API Spec：B-07 是否已完成？
    ↓
是 → 直接联调
否 → 使用 Mock 数据，标记 TODO
    ↓
后端 Agent 完成 B-07
    ↓
验收 Agent 执行联调测试
    ↓
通过 → 关闭两个 Issue
失败 → 分发 Bug 回各自 Agent
```

---

## 八、验收标准

每个 Phase 结束时的检查清单：

```markdown
## Phase 1 验收

- [ ] docker-compose up 后所有服务健康
- [ ] Drizzle 迁移成功
- [ ] MinIO 可上传/下载文件
- [ ] Milvus 可创建 Collection
- [ ] Redis 可读写

## Phase 2 验收

- [ ] 可注册新用户
- [ ] 可登录/登出
- [ ] 未认证请求返回 401
- [ ] 前端路由守卫正常

## Phase 3 验收

- [ ] 可创建/重命名/删除知识库
- [ ] 可创建/重命名/删除虚拟文件夹
- [ ] 可上传文件到指定文件夹
- [ ] 文件状态正确流转
- [ ] 可删除文档

## Phase 4 验收

- [ ] 可创建会话
- [ ] 可发送消息并接收 SSE 流式回复
- [ ] 可选择多个知识库
- [ ] 可保存/读取设置

## Phase 5 验收

- [ ] 文档可自动解析/分块/向量化
- [ ] Milvus 可检索向量
- [ ] RAG 回答包含引用来源
```

---

*文档结束*

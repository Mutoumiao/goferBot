# GoferBot

GoferBot — 云端优先的 AI Workspace / Agent OS。基于 Vue 3 + NestJS 的 Web 应用，支持文档管理、LLM 问答、RAG 检索增强。

**架构定位**：云端优先、本地缓存、可扩展 SaaS、AI Native Infrastructure。
**技术栈**：Vue 3 + NestJS 10 + Fastify + PostgreSQL + MinIO + Milvus + Redis + BullMQ。

用户可导入文档进行管理，通过 LLM 进行问答，支持 RAG 检索增强。

## Agent 规则（核心行为约束）

核心倾向：谨慎优先；遇不确定先提问，存在歧义列出路径；更简方案须果断提出。

1. **先思后码**：声明假设，不确定就问。规则冲突时优先“简单至上”。
2. **简单至上**：最少代码，杜绝“以防万一”。资深工程师不会觉得过复杂。
3. **外科手术式修改**：只改必要处。不顺手优化相邻代码，除非确定性错误/安全漏洞（标`#adjacent-fix`）。
4. **目标驱动**：明确成功标准，迭代至验证通过。
5. **模型仅用于判断**（分类/起草/摘要/提取）。路由/重试由代码处理。
6. **Token预算**：单任务≤8k，会话≤30k。超80%暂停并压缩；超95%终止。
7. **显式冲突**：矛盾时明确择一，另一处标记待清理，不调和。
8. **落笔先阅读**：通读导出接口、调用方、公共工具。不理解先提问。
9. **测试验证意图**：测试体现行为*为何重要*。业务逻辑变更时测试应失败。
10. **检查点**：每关键步骤后输出 `[CHECKPOINT] ✅已完成|🔍已验证|⏳待办|🚨阻塞`。
11. **遵从规范**：一致性 > 个人偏好。不暗中另起范式。
12. **显式失败**：不静默跳过。置信度<90%输出 `[UNCERTAIN]` 并征求指令。

**禁止行为**：不修改 BACKLOG.md/CHANGELOG.md / 不在 tests/issues/ 外写 issue 用例 / 不提交 console.log / 不全文加载文档 / 不并行未声明优先级的 skill

## 必读文档（开发前按顺序查阅）

| 阶段     | 文档                             |
|----------|----------------------------------|
| 了解流程 | `docs/00-meta/workflow.md`                          |
| 了解产品 | `docs/01-prd/v2-cloud-native.md`                    |
| 领取任务 | `docs/issues/{prefix}-{NN}-{slug}/issue.md`         |
| 编码前   | `docs/issues/{prefix}-{NN}-{slug}/specs/`           |

## 项目结构

```
├── packages/
│   ├── webui/                    # Vue 3 前端（@goferbot/webui）
│   ├── server/                   # NestJS API 服务端（@goferbot/server）
│   └── rag-sdk/                  # RAG 工具库
├── src-tauri/                    # Tauri Rust 后端（冻结，Phase 6 扩展）
├── tests/                        # 测试（单元/集成/E2E）
├── docs/                         # 文档
│   ├── 00-meta/                  # 流程规范、skills
│   ├── 01-prd/                   # 产品需求
│   ├── issues/                   # 活跃 issue（Issue-Centric 结构）
│   ├── 05-adrs/                  # 架构决策记录
│   ├── 06-design/                # 设计系统
│   ├── 07-reviews/               # 审查记录
│   └── 99-archived/              # 历史归档
├── tests/                        # 测试（单元/集成/E2E）
│   ├── issues/                   # 按 issue 组织的单元测试
│   ├── integration/              # 集成测试
│   └── e2e/                      # E2E 测试
├── BACKLOG.md                    # 待办事项（open / in-progress）
├── CHANGELOG.md                  # 完成日志（closed，按日期倒序）
├── pnpm-workspace.yaml
└── package.json
```

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Pinia
- **后端**：NestJS 10 + Fastify + Prisma 5 + JWT + bcrypt
- **数据库**：PostgreSQL 16（元数据）+ Milvus 2.4+（向量检索）
- **对象存储**：MinIO（文件内容）
- **缓存/队列**：Redis 7 + BullMQ
- **测试**：Vitest + Playwright
- **包管理**：pnpm
- **图标**：lucide-vue-next

## 常用命令

```bash
pnpm dev              # 同时启动前后端（webui + server）
pnpm dev:web          # 只启动前端 Vite dev server
pnpm dev:server       # 只启动后端 NestJS（watch 模式）
pnpm test             # 单元测试
pnpm test:e2e         # E2E 测试
pnpm type-check       # TypeScript 类型检查
pnpm -r build         # 构建所有包
```

## 开发规范

### UI 组件

- 使用 [shadcn-vue](https://www.shadcn-vue.com/)，位于 `packages/webui/src/components/ui/`
- 引入：`cd packages/webui && npx shadcn-vue@latest add <component>`
- 颜色使用 Pencil tokens（`bg-surface-1`, `text-text-primary`）
- Class 管理统一使用 `cn()` + `class-variance-authority`

### 后端规范

- 所有 API 响应统一为 `{ data: T }` 格式（由 ResponseInterceptor 处理）
- 异常统一由全局 ExceptionFilter 捕获并标准化
- 认证使用 `@UseGuards(JwtAuthGuard)` + `@CurrentUser()` 装饰器
- Prisma 查询通过 `PrismaService` 注入，禁止直接实例化 `PrismaClient`

## Agent文档读取协议

Agent 读取项目文档时必须遵守分层读取，避免全文加载浪费 token：

1. **先读索引** — 查 `BACKLOG.md` 或 `CHANGELOG.md` 定位目标 issue
2. **再读 frontmatter** — 读 `docs/issues/{dir}/issue.md` 的 YAML 头部获取 `status`/`summary`/`blocked_by`
3. **按需深入正文** — 仅当 frontmatter 确认文档与当前任务相关，且状态非 closed/deprecated 时，才读正文
4. **尽量避免全文扫读** — 不得在未读 frontmatter 前直接读取完整文档

> 各文档类型的 frontmatter 规范参见 `docs/00-meta/` 下对应的 `writing-*.md`。

## Skill routing

当用户请求匹配以下场景时，优先 invoke 对应 skill。

### 项目流程

- 不知道怎么开始/流程是什么/从哪开始 → `/project-workflow`
- 拆 issue/生成工单/任务拆分 → `/issue-generator`
- 审查 spec/写 behavior spec/写 API spec → `/spec-validator`
- 写计划/生成实现方案 → `/plan-generator`
- 开始开发 issue/开发 f-XX/b-XX → `/dev-orchestrator`
- 代码审查 / spec 对齐 / 安全审查 / 验收 → `/kb-review`
- 安全审计/漏洞检查/OWASP → `/kb-review`
- 更新 issue 状态/标记完成 → `/issue-lifecycle`

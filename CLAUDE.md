# GoferBot

GoferBot — 云端优先的 AI Workspace / Agent OS。基于 React + NestJS 的 Web 应用，支持文档管理、LLM 问答、RAG 检索增强。

**技术栈**：React 19 + TanStack Start + NestJS 10 + Fastify + PostgreSQL + MinIO + Redis + BullMQ。

## Agent 核心约束

1. **先思后码**：不确定就问，规则冲突时优先"简单至上"
2. **外科手术式修改**：只改必要处，顺手优化标 `#adjacent-fix`
3. **Token 预算**：单任务≤8k，超 80% 暂停压缩，超 95% 终止
4. **落笔先阅读**：通读导出接口、调用方、公共工具；代码探索优先用 codegraph
5. **检查点**：每关键步骤输出 `[CHECKPOINT] ✅|🔍|⏳|🚨`
6. **显式失败**：置信度<90% 输出 `[UNCERTAIN]` 并征求指令

**禁止行为**：不修改 BACKLOG.md/CHANGELOG.md / 不提交 console.log / 不全文加载文档 / 不并行未声明优先级的 skill

## 必读文档（按顺序）

| 阶段 | 文档 |
|------|------|
| 了解流程 | `docs/guide/workflow.md` |
| 了解产品 | `docs/prd/v2-cloud-native.md` |
| 前端规范 | `.claude/rules/frontend-rules.md` → `web-package-rules.md` → `architecture.md` |
| 后端规范 | `.claude/rules/backend-rules.md` |
| 领取任务 | `docs/issues/{prefix}-{NN}-{slug}/issue.md` |
| 编码前 | `docs/issues/{prefix}-{NN}-{slug}/specs/` |

## 项目结构

```
├── packages/
│   ├── web/           # React 前端（主前端）
│   ├── webui/         # Vue 前端（冻结，待删除）
│   ├── server/        # NestJS API 服务端
│   ├── data/          # 共享数据契约（Zod schemas）
│   └── rag-sdk/       # RAG 工具库
├── docs/              # 文档（guide/prd/issues/adrs/design）
├── tests/             # 测试（unit/integration/e2e）
├── BACKLOG.md         # 待办（open / in-progress）
└── CHANGELOG.md       # 完成日志（closed）
```

## 常用命令

```bash
pnpm dev              # 同时启动前后端
pnpm dev:web          # 只启动前端
pnpm dev:server       # 只启动后端（watch）
pnpm type-check       # TypeScript 类型检查
pnpm test             # 单元测试（vitest）
pnpm test:integration # 模块级集成测试
pnpm test:e2e:api     # HTTP API E2E
pnpm test:e2e         # 浏览器 E2E（Playwright）
pnpm test:all         # 全量回归
```

## Agent 文档读取协议

1. **先读索引** — 查 `BACKLOG.md` / `CHANGELOG.md` 定位目标 issue
2. **再读 frontmatter** — 读 `docs/issues/{dir}/issue.md` 的 YAML 头部获取状态
3. **按需深入正文** — 仅当相关且非 closed/deprecated 时才读正文

## Skill 调用规则

**1% 规则**：只要用户请求有 1% 的可能性匹配某个 skill，就必须调用它。

**指令优先级**：用户显式指令 > 项目 skill > Superpowers skill > 默认行为

### 项目流程路由

| 用户请求 | 必须调用的 skill |
|----------|------------------|
| 不知道怎么开始/流程是什么 | `/project-workflow` |
| 拆 issue/生成工单 | `/issue-generator` |
| 审查 spec/写 behavior spec | `/spec-validator` |
| 写计划/生成实现方案 | `/plan-generator` |
| 开始开发 issue | `/dev-orchestrator` |
| 代码审查 / spec 对齐 / 安全审查 | `/kb-review` |
| 更新 issue 状态/标记完成 | `/issue-lifecycle` |
| 检查 plan/spec/code 是否违反 ADR | `/architecture-guard` |
| 生成测试骨架 | `/test-scaffold` |
| 检查前后端接口一致性 | `/integration-check` |

# GoferBot

GoferBot — 云端优先的 AI Workspace / Agent OS。基于 React + NestJS 的 Web 应用，支持文档管理、LLM 问答、RAG 检索增强。

## 技术栈详情

| Layer         | Technology                | Version                           |
|---------------|---------------------------|-----------------------------------|
| **前端框架**  | React + TanStack Start    | React 19.x, TanStack Start latest |
| **前端路由**  | TanStack Router           | 1.132.x                           |
| **UI 构建**   | Vite + Tailwind CSS       | Vite 6.x, Tailwind 4.x            |
| **状态管理**  | Zustand                   | 5.x                               |
| **后端框架**  | NestJS + Fastify          | NestJS 10.x, Fastify 4.x          |
| **数据库**    | PostgreSQL + pgvector     | PG 16                             |
| **ORM**       | Prisma                    | 5.x                               |
| **向量存储**  | pgvector                  | -                                 |
| **缓存/队列** | Redis + BullMQ            | Redis 7, BullMQ 5.x               |
| **对象存储**  | MinIO (S3兼容)            | -                                 |
| **AI SDK**    | LangChain + @ant-design/x | LangChain 1.x                     |
| **数据校验**  | Zod                       | 3.x                               |
| **测试**      | Vitest                    | 4.x                               |
| **包管理**    | pnpm                      | -                                 |

## Agent 核心约束

1. **先思后码**：不确定就问，规则冲突时优先"简单至上"
2. **外科手术式修改**：只改必要处，顺手优化标 `#adjacent-fix`
3. **Token 预算**：单任务≤8k，超 80% 暂停压缩，超 95% 终止
4. **落笔先阅读**：通读导出接口、调用方、公共工具；代码探索优先用 codegraph
5. **检查点**：每关键步骤输出 `[CHECKPOINT] ✅|🔍|⏳|🚨`
6. **显式失败**：置信度<90% 输出 `[UNCERTAIN]` 并征求指令                            |

## 项目结构

```
├── packages/
│   ├── web/           # React 前端（主前端）
│   ├── server/        # NestJS API 服务端
│   ├── data/          # 共享数据契约（Zod schemas）
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
pnpm format           # biome 格式化（写入）
pnpm format:check     # biome 格式化检查（不写入，CI 用）
pnpm format:unsafe    # biome 格式化（含 unsafe 修复）
pnpm lint             # biome 仅 lint
pnpm check            # biome 检查（format + lint + assist）
pnpm check:fix        # biome 检查并应用安全修复
pnpm check:unsafe     # biome 检查并应用全部修复
pnpm check:staged     # biome 仅处理 git 暂存文件
pnpm check:changed    # biome 仅处理 VCS 变更文件
pnpm check:ci         # biome CI 模式（不写入，错误即非零退出）
```

## Agent 文档读取协议

1. **先读索引** — 查 `BACKLOG.md` / `CHANGELOG.md` 定位目标 issue
2. **再读 frontmatter** — 读 `docs/issues/{dir}/issue.md` 的 YAML 头部获取状态
3. **按需深入正文** — 仅当相关且非 closed/deprecated 时才读正文

## 代码约定

### 文件命名

- **React 组件**: PascalCase（如 `ChatPage.tsx`）
- **TypeScript/TSX 文件**: camelCase（如 `auth.service.ts`）
- **路由文件**: kebab-case（如 `knowledge-base.tsx`）

### 代码模式

- **前端状态管理**: Zustand stores（`stores/` 目录）
- **后端模块**: NestJS 模块模式（Controller + Service + DTO）
- **数据验证**: Zod schemas（共享在 `@goferbot/data` 包）
- **API 调用**: alova（前端） / 内置 Fetch（特定场景）
- **错误处理**: 统一异常过滤器 + ZodValidationPipe

### 测试约定

- **单元测试**: `*.spec.ts` 放在源文件同目录
- **集成测试**: `vitest.integration.config.ts`，`tests/` 目录
- **Mock 风格**: Jest mocks / nock

### Git 提交约定

- 使用简体中文描述
- 格式: `type(scope): description`
- type: `fix`, `feat`, `refactor`, `docs`, `test`, `chore`
- 示例: `fix(chat): 修复消息列表刷新问题`

### 数据库约定

- Prisma schema 位于 `packages/server/prisma/schema.prisma`
- 命名: snake\_case（数据库层）、camelCase（TypeScript）
- 迁移: `pnpm prisma:migrate`

### 环境变量

- 根目录 `.env.example`：项目唯一的完整环境变量模板，包含基础设施、安全策略、服务端应用配置、过渡期模型配置。
- `packages/server/.env.example`：服务端独立覆盖说明文件，通常无需填写；完整变量清单与注释见根目录 `.env.example`。
- `packages/web/.env.example`：前端 Vite 专属配置。
- 加载顺序（服务端）：`packages/server/.env` → 根目录 `.env`，后加载的覆盖先加载的同名变量。
- 配置管理指南：`docs/guide/backend/configuration-guide.md`

## 数据库模型（核心）

```
User ←→ KnowledgeBase ←→ Folder ←→ Document ←→ Chunk
   ↓                              ↓
   Session                        (向量数据)
   ↓
Setting
```

- **User**: 用户账户（email, password, role）
- **KnowledgeBase**: 知识库（属于用户）
- **Folder**: 文件夹（树形结构，支持嵌套）
- **Document**: 文档（存储在 MinIO，metadata 在 DB）
- **Chunk**: 文档切片（用于 RAG 检索，向量存储在 pgvector）
- **Session**: 聊天会话
- **Setting**: 用户设置


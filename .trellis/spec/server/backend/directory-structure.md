# Directory Structure

> GoferBot 后端模块组织与文件布局约定

---

## 顶层结构

```
packages/server/src/
├── main.ts                  ← Fastify 启动入口
├── app.module.ts            ← 根模块（注册所有子模块）
├── bootstrap.ts             ← 应用引导逻辑
├── env.ts                   ← 环境变量加载
│
├── auth/                    ← 认证模块（跨模块共享）
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── auth-redis.service.ts
│   ├── captcha.service.ts
│   ├── captcha.controller.ts
│   ├── dto/
│   ├── guards/              ← JWT / Roles / Permission Guards
│   ├── strategies/          ← Passport 策略
│   ├── decorators/          ← @CurrentUser
│   ├── crypto/              ← 密码加密工具
│   ├── listeners/           ← 领域事件监听器
│   ├── repositories/        ← Auth 仓储
│   └── errors.ts            ← 领域错误工厂函数
│
├── modules/                 ← 业务模块（领域驱动）
│   ├── admin/               ← 管理后台
│   ├── chat/                ← 聊天 + LLM 提供商
│   │   └── llm/             ← LLM Provider 工厂/接口
│   ├── companion/           ← AI 伴侣
│   │   ├── langgraph/       ← LangGraph 状态图
│   │   │   └── nodes/       ← 11 个管线节点
│   │   ├── langchain/       ← LangChain LLM 服务
│   │   └── config/          ← 伴侣配置
│   ├── health/              ← 健康检查
│   ├── knowledge-base/      ← 知识库管理
│   ├── session/             ← 会话管理
│   ├── settings/            ← 用户设置
│   └── user/                ← 用户管理
│       ├── events/          ← 领域事件
│       └── services/        ← 引导服务
│
├── processors/              ← 基础设施处理器（全局复用）
│   ├── chat/                ← Chat 后处理器
│   ├── database/            ← Prisma 封装
│   ├── parser/              ← 文档解析器（策略模式）
│   ├── queue/               ← BullMQ 队列
│   ├── rag/                 ← RAG 检索管线
│   │   ├── dto/
│   │   └── listeners/
│   └── storage/             ← MinIO 存储
│
├── queue/                   ← BullMQ 基础设施定义
│   ├── queues.ts            ← 队列/JobData 定义
│   ├── workers.ts           ← Worker 工厂函数
│   ├── redis.ts             ← Redis 连接工厂
│   └── index.ts             ← 桶导出
│
├── common/                  ← 通用 HTTP 层
│   ├── filters/             ← 异常过滤器
│   ├── interceptors/        ← 响应拦截器
│   ├── middleware/          ← 中间件
│   └── services/            ← 通用服务
│
├── shared/                  ← 共享基础设施
│   ├── repositories/        ← BaseRepository + TransactionManager
│   ├── cache/               ← 缓存服务
│   ├── interfaces/          ← 共享类型
│   └── dto/                 ← 通用 DTO
│
└── lib/                     ← 底层工具
    ├── app-error.ts         ← AppException 基类
    └── errors.ts            ← RepositoryError 层次
```

---

## 模块内部约定

### 基础结构（所有模块）

```
{module}/
├── {module}.module.ts       ← NestJS Module 定义
├── {module}.controller.ts   ← REST Controller（可选）
├── {module}.service.ts      ← 业务逻辑
├── dto/                     ← 请求/响应 DTO
└── errors.ts                ← 领域错误工厂函数（可选）
```

### 进阶结构（按需添加）

| 子目录 | 用途 | 使用模块 |
|--------|------|---------|
| `repositories/` | I-* 接口 + Prisma 实现 | Session, KB, Companion |
| `events/` | 领域事件定义 | User |
| `listeners/` | 事件监听器（跨模块通信） | Auth, KB |
| `config/` | 模块级配置 | Companion |
| `interfaces/` | 模块内接口 | Chat |
| `langgraph/nodes/` | LangGraph 管线节点 | Companion |

### 处理器结构

```
processors/{processor}/
├── {processor}.module.ts    ← NestJS Module
├── {processor}.service.ts   ← 核心服务
├── {processor}.types.ts     ← 类型/接口定义（可选）
├── {processor}.provider.ts  ← 工厂 Provider（可选，如 storage）
└── dto/                     ← 请求 DTO（可选，如 rag）
```

### 处理器双层架构约定

`processors/` 目录按职责分为两层，禁止跨层反向依赖：

**第一层：纯基础设施层（pure infrastructure）**
- 不依赖任何业务模块，只被其他模块依赖
- 目录示例：`database/`（PrismaService、TransactionManager）、`storage/`（StorageService、MinIO provider）
- 规则：只对外提供服务，从不 import 业务模块

**第二层：编排处理器层（orchestration processors）**
- 依赖业务模块的领域类型或共享服务
- 目录示例：`rag/`（依赖 ModelProviderService、SystemConfigService）、`queue/`（依赖 ChatModule、SettingsModule）、`chat/`（依赖 ConversationService、LlmProviderFactory）
- 规则：允许 import `modules/` 中的领域类型和共享服务，但通过事件驱动与业务模块解耦

**事件驱动松耦合模式**：
- 编排处理器使用 NestJS `EventEmitter` 监听领域事件（如 `document-uploaded`）
- 监听器放在 `processors/{name}/listeners/` 下
- 禁止从处理器反向 import 业务服务，所有交互通过事件或共享接口

---

## 文件命名约定

| 类型 | 命名 | 示例 |
|------|------|------|
| Module | `{name}.module.ts` | `chat.module.ts` |
| Controller | `{name}.controller.ts` | `chat.controller.ts` |
| Service | `{name}.service.ts` | `chat.service.ts` |
| Repository | `{name}.repository.ts` | `message.repository.ts` |
| Repository 接口 | `i-{name}-repository.ts` | `i-message-repository.ts` |
| DTO | `{action}-{name}.dto.ts` | `create-session.dto.ts` |
| Event | `{name}.event.ts` | `user-password-changed.event.ts` |
| Listener | `{name}.listener.ts` | `document-uploaded.listener.ts` |
| Guard | `{name}.guard.ts` | `jwt.guard.ts` |
| Error factories | `errors.ts` | `auth/errors.ts` |

## 导入路径

- 跨模块引用：相对路径 `../../shared/...` 或 `../../processors/...`
- 同模块内：相对路径 `./dto/...` 或 `./repositories/...`
- 共享 Schema：`@goferbot/data/schemas`
- NestJS 包：`@nestjs/common`

---

## 不要做的事

- ❌ 把业务逻辑放在 `common/` 或 `shared/` — 这些是纯基础设施
- ❌ 在 `processors/` 新建业务模块 — 新业务模块放 `modules/`
- ❌ 跨模块直接注入对方的 Service — 通过 Repository 接口或 EventEmitter
- ❌ 在模块内使用 `index.ts` 桶导出替代明确的 import 路径（import 顺序由 biome 管理）

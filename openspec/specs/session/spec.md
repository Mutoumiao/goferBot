# Session - 会话与消息管理

## Purpose（目的）

定义 GoferBot 会话（Session）和消息（Message）管理的系统级规范。覆盖会话 CRUD、Repository 模式、所有权校验、消息分页与回溯。

## Requirements（需求）

### Requirement: Session CRUD with Ownership
系统应支持会话的创建、列出、读取、更新和删除，并在所有操作上强制执行所有权验证。

证据来源：
- `packages/server/src/modules/session/session.controller.ts`
- `packages/server/src/modules/session/session.service.ts#L67-L85`

#### Scenario: 创建会话
- **WHEN** 用户使用标题、provider 和 model 创建新会话
- **THEN** 系统创建与该用户关联的会话记录；默认标题为"新对话"

#### Scenario: 列出带消息计数的会话
- **WHEN** 用户列出自己的会话
- **THEN** 系统返回按最后活动时间排序（updatedAt desc）的分页结果，通过 Prisma `_count.messages` 聚合包含 `messageCount`；默认每页大小为 50

#### Scenario: 所有权验证
- **WHEN** 用户访问不属于自己的会话
- **THEN** 如果会话不存在，系统返回 404；如果会话属于其他用户，返回 403 Forbidden

#### Scenario: 删除会话
- **WHEN** 用户删除会话
- **THEN** 系统删除该会话并级联删除所有关联的消息

### Requirement: Message Management
系统应支持列出会话内的消息，并检索特定消息之前的消息历史（上下文窗口截断）。

证据来源：
- `packages/server/src/modules/session/repositories/message.repository.ts#L13-L41`
- `packages/server/src/modules/session/session.service.ts#L116-L148`

#### Scenario: 分页消息列表
- **WHEN** 用户请求会话的消息
- **THEN** 系统返回按 createdAt 升序排列的消息，支持分页（基于偏移量，默认每页大小 50）和 `hasMore` 标志

#### Scenario: 上下文窗口截断
- **WHEN** 调用 `findUpToMessageId(sessionId, messageId)`
- **THEN** 系统返回从会话开始到指定消息（包含）的所有消息，按 createdAt 升序排列；如果消息不属于该会话，抛出 NotFoundException

### Requirement: Repository Pattern
系统应实现 BaseRepository 抽象类，提供通用的 CRUD、分页和存在性检查操作，模块特定的 Repository 应导出以供跨模块使用。

证据来源：
- `packages/server/src/shared/repositories/base.repository.ts#L13-L80`
- `packages/server/src/modules/session/session.module.ts#L10`

#### Scenario: BaseRepository CRUD
- **WHEN** Repository 继承 `BaseRepository<T, CreateInput, UpdateInput>` 并设置 `modelName`
- **THEN** 它继承 `findAll`、`findById`、`create`、`update`、`delete`、`paginate` 和 `exists` 方法，这些方法委托给对应的 Prisma model

#### Scenario: Repository 导出供跨模块使用
- **WHEN** SessionModule 被另一个模块（如 Chat）导入
- **THEN** 导入模块可以注入 `SessionRepository` 和 `MessageRepository` 进行直接数据访问

#### Scenario: 事务支持
- **WHEN** Repository 操作需要参与事务
- **THEN** 它可以使用 `this.tx`（TransactionCapable）访问事务性 Prisma client

### Requirement: DTO Validation via Zod
系统应使用 `nestjs-zod` 的 `createZodDto` 从共享 `@goferbot/data` 包中定义的 Zod schemas 生成 DTO。

证据来源：
- `packages/server/src/modules/session/dto/create-session.dto.ts#L4`
- `packages/server/src/modules/session/dto/update-session.dto.ts#L4`

#### Scenario: 创建会话验证
- **WHEN** 收到创建会话请求
- **THEN** 在到达服务层之前，请求体应根据 `@goferbot/data/schemas` 中的 `createSessionRequestSchema` 进行验证

#### Scenario: 更新会话验证
- **WHEN** 收到重命名会话请求
- **THEN** 请求体应根据 `@goferbot/data/schemas` 中的 `updateSessionRequestSchema` 进行验证

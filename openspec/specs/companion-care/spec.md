# Companion Care - 主动关怀

## Purpose（目的）

定义 AI 伴侣**主动关怀**产品能力：Care Plan 读写、场景/语气枚举、手动生成关怀消息入会话、前端配置入口。本能力**不**包含定时 Cron/队列自动投递（`nextRunAtMs` 仅供未来扩展）。

> 人设与管线主规范见 [companion](../companion/spec.md)、[companion-persona](../companion-persona/spec.md)。

## Requirements（需求）

### Requirement: Care Plan 每伴侣一份

系统 MUST 为每个（userId, companionId）维护至多一份主动关怀计划（Care Plan），支持读取与更新；计划 MUST 包含启用开关、频率、可选偏好时间、场景集合、语气、可选自定义 Prompt，并可计算/存储 `nextRunAtMs`（当前版本无调度消费）。

证据来源：
- `packages/server/prisma/schema.prisma`（CompanionCarePlan）
- `packages/server/src/modules/companion/companion-care.service.ts`
- 行为权威：ai-partner-agent care-plan API

#### Scenario: 获取计划（无行时返回未持久化默认）

- **WHEN** 所有者请求某伴侣的 care-plan 且数据库尚无对应行时
- **THEN** 系统 MUST 返回 HTTP 成功与一份**服务端默认计划对象**（enabled/frequency/scenes/tone 等有稳定默认值）
- **AND** MUST NOT 仅因 GET 而插入数据库行（首次持久化发生在成功的 PATCH/更新）

#### Scenario: 获取计划（已有行）

- **WHEN** 所有者请求某伴侣的 care-plan 且已存在持久化行时
- **THEN** 系统 MUST 返回该行字段，不得用默认值静默覆盖已存配置

#### Scenario: 更新计划

- **WHEN** 所有者提交合法的 care-plan 更新时
- **THEN** 系统 MUST upsert 持久化 enabled、frequency、preferredTime、scenes、tone、customPrompt 等字段
- **AND** SHOULD 更新 `nextRunAtMs` 计算结果
- **AND** MUST NOT 启动或依赖 Cron/队列自动投递

#### Scenario: 鉴权

- **WHEN** 非所有者请求他人伴侣的 care-plan 时
- **THEN** 系统 MUST 拒绝访问

### Requirement: 关怀场景与语气枚举

Care Plan 的场景 MUST 覆盖六类稳定枚举；语气 MUST 支持 light / gentle / intimate 三档。枚举 MUST 在 packages/data Zod 与服务端模板常量间保持一致。

证据来源：
- `packages/server/src/modules/companion/persona/care-message-templates.ts`（`CARE_SCENES` / `CARE_TONES`）
- `packages/data` care 相关 Zod schema

#### Scenario: 六场景

- **WHEN** 配置或生成关怀时
- **THEN** 系统 MUST 识别并支持：`morning`、`night`、`long_absence`、`stress_support`、`relationship_warmup`、`anniversary`（全链路一致）

#### Scenario: 三语气

- **WHEN** 计划 tone 为 light、gentle 或 intimate 时
- **THEN** 生成文案 MUST 应用对应语气前缀/模板策略

### Requirement: 手动生成关怀事件并写入会话

系统 MUST 提供手动生成接口：根据计划与选定场景生成关怀消息文本（模板 + 可选 customPrompt，**不**跑完整 11 节点情感管线），写入该用户与该伴侣的会话为助手消息，并创建 CareEvent 关联 conversationId/messageId/scene。

证据来源：
- `packages/server/prisma/schema.prisma`（CompanionCareEvent）
- `packages/server/src/modules/companion/companion-care.service.ts`

#### Scenario: 生成入会话

- **WHEN** 所有者对已存在伴侣调用手动 generate 且计划允许时
- **THEN** 系统 MUST 在对应会话中新增一条助手消息，内容为关怀文案
- **AND** MUST 创建 status 可追踪的 CareEvent 记录

#### Scenario: 不经全管线

- **WHEN** 执行关怀生成时
- **THEN** 系统 MUST NOT 将关怀主路径实现为完整 Companion LangGraph 11 节点调用

#### Scenario: 无 Cron

- **WHEN** 当前产品版本部署后
- **THEN** 系统 MUST NOT 依赖定时任务自动调用 generate（`nextRunAtMs` 仅供未来扩展）

### Requirement: 关怀前端配置入口

Web Companion 模块 MUST 在伴侣上下文提供 Care Plan 配置与「立即生成」操作，生成成功后用户 MUST 能在聊天历史中看到新消息（刷新或实时更新）。

证据来源：
- `packages/web/src/features/companion/components/CompanionCarePage.tsx`
- 路由：`/companions/:id/care`

#### Scenario: 配置与生成

- **WHEN** 用户在伴侣关怀设置中保存计划并点击立即生成时
- **THEN** 系统 MUST 调用后端 API 完成持久化与生成
- **AND** MUST 向用户反馈成功或失败原因

#### Scenario: 关怀消息可识别

- **WHEN** 关怀生成的助手消息出现在聊天历史中时
- **THEN** 客户端 SHOULD 展示可识别标记（如「关怀」小标签或等价文案）
- **AND** 消息 metadata 或 CareEvent.scene MUST 可供客户端区分普通回复与关怀消息

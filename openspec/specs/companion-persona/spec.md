# Companion Persona - 人设 / 创建 / 头像 / 开场白

## Purpose（目的）

定义 AI 伴侣**人设产品面**：字段命名、defaultPrompt 多节拼接、独立创建/编辑页、头像校验与上传、空会话开场白。对话管线与状态机见 [companion](../companion/spec.md)；主动关怀见 [companion-care](../companion-care/spec.md)。

## Requirements（需求）

### Requirement: 人设字段模型保留 GoferBot 命名

伴侣人设 API 与持久化 MUST 继续使用 GoferBot 字段名：`name`、`headline`、`description`、`personality`、`tone`、`boundaries`、`guardrailsPrompt`、`defaultPrompt`、`backgroundStory`、`openingMessage`、`avatarKey`、`visibility`、`status` 等；MUST 增加 `source`（及可空 `userId` 语义）；MUST NOT 为对齐参考项目而强制重命名为 `personalityPrompt` 等列名。

证据来源：
- `packages/server/prisma/schema.prisma`（Companion）
- `packages/web/src/features/companion/types.ts`

#### Scenario: 创建载荷字段

- **WHEN** 客户端创建或更新伴侣时
- **THEN** 请求体 MUST 使用上述 GoferBot 字段名（Web 仅简表子集），服务端 MUST 正确持久化允许写入的字段

### Requirement: defaultPrompt 多节拼接

创建或更新伴侣人设相关字段时，系统 MUST 按固定章节模板拼接生成 `defaultPrompt`（角色声明、一句话设定、角色说明、人物故事、性格与互动、语气风格、边界与安全、回复要求等），空节 MUST 可省略。对 **user 源**，边界与安全节 MUST 按「安全权威与运行时合并」使用全局/兜底，而非客户端提交值。对 **system 源**，使用行内安全字段。进入 generate 时 MUST 纳入解析后的人设全文。

证据来源：
- `packages/data/src/schemas/build-default-agent-prompt.ts`
- `packages/server/src/modules/companion/companion.service.ts`

#### Scenario: 保存时生成

- **WHEN** 保存包含人设字段的伴侣时
- **THEN** 服务端 MUST 写入非空的结构化 `defaultPrompt`（在至少有最小必填人设时）
- **AND** 拼接映射 MUST 使用：`headline`/`description`→设定与说明，`backgroundStory`→故事，`personality`→性格，`tone`→语气，安全节→权威源 boundaries/guardrails

#### Scenario: 客户端预览

- **WHEN** **Admin** 在内置伴侣创建/编辑界面编辑人设字段时
- **THEN** 界面 SHOULD 提供与服务端规则一致的 defaultPrompt 预览
- **WHEN** **Web** 用户编辑自定义简表时
- **THEN** 界面 MUST NOT 依赖 defaultPrompt 预览作为必达能力

#### Scenario: 进入 generate 注入链

- **WHEN** 用户与该伴侣进行对话时
- **THEN** generate 节点组装 system prompt 时 MUST 纳入按权威源解析的人设全文
- **AND** 对 user 源 MUST 使安全节与当前全局配置一致（允许覆盖库内 defaultPrompt 安全节）

### Requirement: 创建与编辑信息架构

**Web 自定义**创建/编辑主路径 MUST 提供独立页面级**简表**体验；MUST 创建即 `published`。**Admin 内置** MUST 提供完整人设表单并支持 draft/published/archived 状态管理。存量自定义伴侣编辑时，简表未展示的旧扩展字段（如 headline/tone/story）MUST 保留在库中且 MUST NOT 被简表保存主动清空；安全节权威仍按 user 源规则。

证据来源：
- `packages/web/src/features/companion/components/CompanionFormPage.tsx`
- 路由：`/companions/new`、`/companions/:id/edit`
- Admin 内置路由

#### Scenario: 独立创建入口

- **WHEN** 用户从「我的」选择创建伴侣时
- **THEN** 系统 MUST 进入简表创建流程（独立路由页或等价全页体验）

#### Scenario: 编辑回填

- **WHEN** 用户编辑已有自定义伴侣时
- **THEN** 系统 MUST 回填简表字段与头像，MUST NOT 回填或要求安全字段
- **AND** 保存后 MUST 给出明确成功/失败反馈
- **AND** 未出现在简表中的旧扩展字段 MUST 保持原值（除非 Admin/迁移显式清理）

#### Scenario: 自定义无草稿步骤

- **WHEN** Web 用户成功创建自定义伴侣时
- **THEN** 状态 MUST 为 `published`，MUST NOT 强制用户再执行发布操作

### Requirement: 头像上传与校验闭环

伴侣头像 MUST 通过现有对象存储（MinIO/storage）上传获得 `avatarKey`；MUST 在客户端与服务端实施格式/大小/尺寸类校验（复用 storage 能力并叠加伴侣策略）；主路径 MUST 为文件选择上传，MUST NOT 仅依赖用户手填 storage key。

#### Scenario: 上传成功

- **WHEN** 用户选择符合策略的图片并上传时
- **THEN** 系统 MUST 返回可用的 `avatarKey`，伴侣保存后列表/详情 MUST 能展示头像

#### Scenario: 校验失败

- **WHEN** 用户上传不支持格式、超限大小或不符合尺寸策略的图片时
- **THEN** 系统 MUST 拒绝并返回可理解的错误信息，MUST NOT 写入非法对象为有效头像

#### Scenario: 伴侣头像策略基线（对齐参考项目量级）

- **WHEN** 定义伴侣头像硬性校验时
- **THEN** 系统 MUST 至少支持 PNG/JPEG/WebP
- **AND** MUST 限制文件大小上限（默认 ≤ 5MB，除非项目统一上传策略更严）
- **AND** MUST 校验最小边与宽高比：最短边 ≥ 720px，目标比例约 2:3（宽:高），允许实现定义小幅容差（如 ±5%），容差与上限 MUST 写入黄金测试常量

#### Scenario: 存储复用

- **WHEN** 实现头像存储时
- **THEN** 系统 MUST 复用 GoferBot storage/MinIO 适配，MUST NOT 引入参考项目 R2 专用运行时依赖

### Requirement: 开场白

若伴侣配置了非空 `openingMessage`，系统 MUST 在**该用户与该伴侣会话尚无任何消息**（`messageCount === 0` 或等价：消息列表为空）时向用户展示开场白；已有历史消息时 MUST NOT 再次自动插入开场白。

#### Scenario: 空会话展示开场白

- **WHEN** 用户进入与某伴侣的对话，会话消息列表为空，且 `openingMessage` 非空时
- **THEN** 用户 MUST 能看到该开场白内容（可作为首条助手气泡展示；持久化策略：若服务端未写入历史，客户端展示的临时开场白在用户发送首条消息后不得重复再插一条相同开场白）

#### Scenario: 非空会话不重复

- **WHEN** 会话中已存在至少一条消息时
- **THEN** 系统 MUST NOT 因再次进入页面而自动追加新的开场白消息

#### Scenario: 无开场白配置

- **WHEN** `openingMessage` 为空或未设置时
- **THEN** 系统 MUST NOT 展示空白开场白气泡

### Requirement: 字段权属三层模型

系统 MUST 区分三层人设权属：

1. **Web 自定义（user）可写**：`name`（必填）、`description`（必填）、`personality`（必填）、`openingMessage`（可选）、`avatarKey`（可选）
2. **Admin 内置（system）可写**：完整人设字段（含 `headline`、`tone`、`backgroundStory`、`boundaries`、`guardrailsPrompt`、`openingMessage`、头像等）
3. **平台全局配置**：`settings.companion.defaultBoundaries` 与 `defaultGuardrailsPrompt`，作为 **user 源**安全权威；空时使用服务端代码兜底模板

Web 自定义 UI MUST NOT 展示或收集 `headline`、`tone`、`backgroundStory`、`boundaries`、`guardrailsPrompt`；`visibility` 对自定义 MUST 固定为 private（或不暴露选择器）。

证据来源：
- `packages/data/src/schemas/companion.schema.ts`
- `packages/web/src/features/companion/`
- `packages/admin/` 内置表单

#### Scenario: Web 简表字段集合

- **WHEN** Web 用户打开创建/编辑自定义伴侣时
- **THEN** 表单 MUST 仅包含简表字段（及可选头像）
- **AND** MUST NOT 出现边界设定或安全提示词输入框

#### Scenario: Admin 全字段

- **WHEN** 管理员编辑内置伴侣时
- **THEN** 表单 MUST 允许编辑完整人设含边界与安全字段

#### Scenario: 拒绝 Web 注入安全字段

- **WHEN** Web 客户端在创建/更新自定义伴侣请求中携带 `boundaries`、`guardrailsPrompt` 或 `defaultPrompt` 时
- **THEN** 服务端 MUST **剥离忽略**（简表 Zod 不接收；多余键 strip），MUST NOT 将客户端值作为安全权威持久或参与运行时合并
- **AND** MUST NOT 仅因携带上述键而 4xx（避免旧客户端误伤）；权威始终为全局/代码兜底

### Requirement: 安全权威与运行时合并

对 `source=user` 的伴侣，边界与安全文案的权威源 MUST 为**当前**全局模块配置（空则代码兜底），MUST NOT 以用户历史写入行内字段或陈旧 `defaultPrompt` 安全节为准。对 `source=system` 的伴侣，权威源 MUST 为行内 `boundaries` / `guardrailsPrompt`。进入 generate 注入链前，系统 MUST 按权威源解析人设全文（可重算或覆盖安全节）。

证据来源：
- `packages/server/src/modules/companion/`（resolvePersona / pipeline prepare）
- `packages/data/src/schemas/build-default-agent-prompt.ts`

#### Scenario: 全局配置变更立即作用于自定义对话

- **WHEN** Admin 更新全局 defaultBoundaries/defaultGuardrailsPrompt 后，用户与既有自定义伴侣对话时
- **THEN** 本轮 system prompt 安全节 MUST 反映**新**全局配置（或新兜底），MUST NOT 永久锁定创建时快照

#### Scenario: 内置使用行内安全

- **WHEN** 用户与 system 伴侣对话且该伴侣配置了行内 guardrails 时
- **THEN** 安全节 MUST 使用该伴侣行内值，MUST NOT 强制替换为全局默认

#### Scenario: 全局为空时代码兜底

- **WHEN** 全局安全配置皆空且用户创建或对话自定义伴侣时
- **THEN** 系统 MUST 使用服务端内置最小安全模板，MUST NOT 因配置为空而阻断创建（除非另有独立错误）

### Requirement: Web API 人设字段剥离

面向 Web 用户的伴侣列表与详情响应 MUST NOT 包含 `boundaries`、`guardrailsPrompt`、完整 `defaultPrompt`。Admin API 响应 MUST 返回完整人设字段以便编辑。Web UI MUST NOT 提供 defaultPrompt 预览（Admin 内置编辑 MAY 保留预览）。

#### Scenario: Web 详情无安全字段

- **WHEN** Web 客户端请求伴侣详情时
- **THEN** 响应体 MUST NOT 暴露 `boundaries`、`guardrailsPrompt`、`defaultPrompt`

#### Scenario: Admin 详情完整

- **WHEN** 具备权限的管理员请求内置伴侣详情时
- **THEN** 响应 MUST 包含边界、安全与 defaultPrompt 等编辑所需字段

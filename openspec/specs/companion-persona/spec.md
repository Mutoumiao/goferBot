# Companion Persona - 人设 / 创建 / 头像 / 开场白

## Purpose（目的）

定义 AI 伴侣**人设产品面**：字段命名、defaultPrompt 多节拼接、独立创建/编辑页、头像校验与上传、空会话开场白。对话管线与状态机见 [companion](../companion/spec.md)；主动关怀见 [companion-care](../companion-care/spec.md)。

## Requirements（需求）

### Requirement: 人设字段模型保留 GoferBot 命名

伴侣人设 API 与持久化 MUST 继续使用 GoferBot 字段名：`name`、`headline`、`description`、`personality`、`tone`、`boundaries`、`guardrailsPrompt`、`defaultPrompt`、`backgroundStory`、`openingMessage`、`avatarKey`、`visibility`、`status` 等；MUST NOT 为对齐参考项目而强制重命名为 `personalityPrompt` 等列名。

证据来源：
- `packages/server/prisma/schema.prisma`（Companion）
- `packages/web/src/features/companion/types.ts`

#### Scenario: 创建载荷字段

- **WHEN** 客户端创建或更新伴侣时
- **THEN** 请求体 MUST 使用上述 GoferBot 字段名，服务端 MUST 正确持久化

### Requirement: defaultPrompt 多节拼接

创建或更新伴侣人设相关字段时，系统 MUST 按固定章节模板拼接生成 `defaultPrompt`（对齐 ai-partner-agent 多节结构：角色声明、一句话设定、角色说明、人物故事、性格与互动、语气风格、边界与安全、回复要求等），并将结果持久化；空节 MUST 可省略而非写入空洞标题堆。

证据来源：
- `packages/data/src/schemas/build-default-agent-prompt.ts`
- `packages/server/src/modules/companion/companion.service.ts`

#### Scenario: 保存时生成

- **WHEN** 用户保存包含 personality/tone/backgroundStory 等人设字段的伴侣时
- **THEN** 服务端 MUST 写入非空的结构化 `defaultPrompt`（在至少有最小必填人设时）
- **AND** 拼接映射 MUST 使用：`headline`/`description`→设定与说明，`backgroundStory`→故事，`personality`→性格，`tone`→语气，`boundaries` 与 `guardrailsPrompt`→边界与安全

#### Scenario: 客户端预览

- **WHEN** 用户在创建/编辑界面编辑人设字段时
- **THEN** 界面 SHOULD 提供与服务端规则一致的 defaultPrompt 预览，避免前后端章节顺序不一致

#### Scenario: 进入 generate 注入链

- **WHEN** 用户与该伴侣进行对话且 `defaultPrompt` 已持久化时
- **THEN** generate 节点组装 system prompt 时 MUST 纳入该 `defaultPrompt`（或等价人设全文），MUST NOT 仅入库而不参与生成

### Requirement: 创建与编辑信息架构

Companion 创建/编辑主路径 MUST 提供独立页面级表单体验（分段展示人设字段，而非仅不可扩展的极简 Dialog 作为唯一入口）；MUST 支持 draft/published 状态设置（在字段允许范围内）。

证据来源：
- `packages/web/src/features/companion/components/CompanionFormPage.tsx`
- 路由：`/companions/new`、`/companions/:id/edit`

#### Scenario: 独立创建入口

- **WHEN** 用户从列表选择创建伴侣时
- **THEN** 系统 MUST 进入完整创建表单流程（独立路由页或等价全页体验）

#### Scenario: 编辑回填

- **WHEN** 用户编辑已有伴侣时
- **THEN** 系统 MUST 回填已有人设字段与头像，保存后 MUST 给出明确成功/失败反馈

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

状态: needs-triage
分类: enhancement

## 要构建的内容

实现设置 API，支持获取和保存 LLM 提供商、Embedding 提供商、通用配置。

## 规格引用

- 功能规格: docs/03-specs/features/settings/feature-spec.md
- 行为规格: docs/03-specs/features/settings/behavior-spec.md
- API 规格: docs/03-specs/features/settings/api-spec.md

## 验收标准

- [ ] `GET /api/settings` 返回当前用户配置（LLM 提供商、Embedding、通用）
- [ ] `POST /api/settings` 保存配置（全量更新）
- [ ] 配置结构符合 PRD 模型：providers、embeddingProvider、temperature、defaultChatProvider
- [ ] 敏感字段（API Key）使用 AES-256-GCM 加密存储，密钥从 OS keychain 派生
- [ ] `GET /api/settings` 返回时将 apiKey 替换为脱敏掩码（如 `sk-****`），不返回完整值
- [ ] 配置按用户隔离（userId 关联）
- [ ] 首次获取时返回默认配置（若用户无配置记录）
- [ ] 配置验证：temperature 范围 0-2，provider 名称合法
- [ ] 所有接口需要认证
- [ ] 错误码规范（400/401）

## 阻塞于

- i-02-drizzle-orm-setup（需要 settings 表或扩展 users 表）
- b-01-auth-api（需要认证中间件）

## 范围外

- 配置导入/导出
- 配置版本历史
- 团队/组织级配置

## Agent 简报

**分类：** enhancement
**摘要：** 设置 API：获取和保存 LLM、Embedding、通用配置

**当前行为：**
后端无配置管理接口。

**期望行为：**
用户配置持久化到数据库，支持多提供商管理和敏感信息加密。

**关键接口：**
- `GET /api/settings` — 获取配置
- `POST /api/settings` — 保存配置
- 配置模型：providers、embeddingProvider、temperature、defaultChatProvider

**验收标准：**
- [ ] 获取配置 API
- [ ] 保存配置 API
- [ ] 配置结构符合 PRD
- [ ] API Key 加密存储
- [ ] 用户配置隔离
- [ ] 首次返回默认配置
- [ ] 配置验证
- [ ] 接口需要认证
- [ ] 错误码规范

**范围外：**
- 配置导入/导出
- 配置版本历史
- 团队配置

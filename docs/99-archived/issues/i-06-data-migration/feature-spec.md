# 功能规格：V1 数据导出工具

## 用户故事

作为 V1 用户，我希望将旧版本中的会话、消息和知识库数据导出为标准格式，以便在新版本 V2 中继续使用。

## 边界

### 范围内
- 导出 V1 SQLite 数据库中的 sessions（会话）
- 导出 messages（消息，关联到原会话）
- 导出 knowledge_bases（知识库元数据）
- 输出格式为 NDJSON（每行一条 JSON 记录）
- 导出后显示统计摘要（N 个会话、M 条消息、K 个知识库）
- 仅读取 V1 数据库，不修改

### 范围外
- 自动导入到 V2 PostgreSQL（需用户手动执行导入）
- V1 文件/文档内容迁移（V1 本地文件 → V2 MinIO）
- 向量数据迁移（V1 sqlite-vec → V2 Milvus，需重新向量化）
- V1 用户设置迁移（配置结构不兼容）
- GUI 界面（纯 CLI 工具）
- V1 文档 chunks 导出（结构差异大，需重新解析）

## 涉及组件
- CLI 脚本：`packages/server/src/tools/export-v1-data.ts`
- npm script：`pnpm export:v1`
- V1 数据库：用户提供的 SQLite 文件路径
- 输出目录：`./v1-export/YYYY-MM-DD/`

## 相关功能
- `b-02-knowledge-base-crud-api` — V2 知识库 schema 参考
- `b-03-session-api` — V2 会话/消息 schema 参考
- `i-02-prisma-setup` — V2 目标数据模型
- `i-09-nestjs-auth-system` — V2 用户 ID 格式参考

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 输出 NDJSON 而非 SQL INSERT | 跨数据库兼容，用户可审查数据后再导入 | 可逆 |
| 使用 `better-sqlite3` 读取 V1 数据库 | V1 使用 better-sqlite3，直接读取无需中间转换 | 不可逆 |
| `--user-id` 必填参数 | V1 无认证系统，导出数据必须归属到 V2 用户 | 可逆 |
| 按日期命名输出目录 | 支持多次导出不覆盖 | 可逆 |
| 不导出 chunks | V1 使用 sqlite-vec 存储向量，与 V2 Milvus 结构不兼容 | 不可逆 |
| 单文件脚本 | 工具性质，不需要模块化架构 | 可逆 |

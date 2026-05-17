---
id: i-06-data-migration
type: issue
status: closed
track: infra
priority: p1
summary: 为 V1 用户提供数据导出工具，将 SQLite 中的会话、消息、知识库信息导出为标准 NDJSON 格式，可导入 V2 的 PostgreSQL。
blocked_by: [b-02-knowledge-base-crud-api, b-05-settings-api, f-13-settings-page]
blocks: []
spec: docs/03-specs/i-06-data-migration/
plan: docs/04-plans/i-06-data-migration/v1.md
tests: docs/08-test-cases/i-06-data-migration/
token_estimate: 1000
---

状态: needs-triage
分类: enhancement

## 要构建的内容

为 V1 用户提供数据导出工具，将 SQLite 中的会话、消息、知识库信息导出为标准格式，可导入 V2 的 PostgreSQL。

## 规格引用

- 架构审查报告: 2026-05-16 (gstack-plan-eng-review)
- ADR: docs/05-adrs/0004-cloud-native-rearchitecture.md

## 验收标准

- [ ] `packages/server/src/tools/export-v1-data.ts` — 数据导出脚本
- [ ] 导出范围：sessions（会话）、messages（消息）、knowledge_bases（知识库元数据）
- [ ] 导出格式：JSON 数组，每行一条记录（NDJSON），与 V2 Drizzle schema 兼容
- [ ] 文档 chunks 可选导出（标记为"需重新向量化"）
- [ ] `pnpm export:v1` 命令可用，输出到 `./v1-export/YYYY-MM-DD/`
- [ ] 导出脚本仅读取 SQLite，不修改 V1 数据库
- [ ] 导出完成后显示统计（N 个会话、M 条消息、K 个知识库）

## 阻塞于

- b-02-knowledge-base-crud-api（V2 知识库 schema 需稳定）
- b-05-settings-api（V2 配置结构需稳定）
- f-13-settings-page（V2 设置页需完成，确认导出范围）

> 实际开发时机：Phase 5 RAG 集成完成后，V2 Drizzle schema 不再变更时启动。

## 范围外

- 自动导入 V2（手动执行 + 验证）
- V1 用户配置文件迁移（settings 需重新配置）
- 向量数据迁移（V1 sqlite-vec → V2 Milvus）

## Agent 简报

**分类：** enhancement
**摘要：** V1→V2 数据导出工具，将 SQLite 数据导出为 V2 兼容的 NDJSON 格式

**当前行为：**
ADR 0004 声明"数据全部丢弃，重新初始化"，无迁移方案。

**期望行为：**
V1 用户可导出现有数据并手动导入 V2。

**关键接口：**
- `packages/server/src/tools/export-v1-data.ts`
- `pnpm export:v1`

**验收标准：**
- [ ] 导出脚本实现
- [ ] NDJSON 格式兼容 V2 Drizzle schema
- [ ] 仅读取不修改 V1 数据库
- [ ] 导出统计输出

**范围外：**
- 自动导入 V2
- 配置文件迁移
- 向量数据迁移

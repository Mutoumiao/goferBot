---
issue_id: i-01-docker-compose-infra
type: feature-spec
status: approved
summary: 一键启动 PostgreSQL、MinIO、Milvus、Redis 四个基础设施服务，通过 docker-compose.dev.yml 定义端口/环境变量/数据卷，封装 pnpm infra:up/down 脚本，含健康检查与 .env 模板。
---
# 功能规格：Docker Compose 开发基础设施

## 用户故事

作为开发者，我希望通过一条命令一键启动 PostgreSQL、MinIO、Milvus、Redis 四个基础设施服务，以便在本地开发环境中快速获得完整的数据存储、对象存储、向量检索和缓存队列能力。

## 边界

- 范围内：
  - `docker-compose.dev.yml` 定义四个基础设施服务（PostgreSQL、MinIO、Milvus、Redis）
  - 各服务的端口映射、环境变量、数据卷配置
  - `pnpm infra:up` / `pnpm infra:down` 脚本封装
  - `.env.example` 环境变量模板
  - 各服务的健康检查配置
  - 开发环境数据持久化到 `./.data/` 目录
- 范围外：
  - 生产环境部署配置
  - 服务监控与告警
  - 数据备份策略
  - Server（Hono Gateway）容器化 — 开发期间手动 `pnpm dev:server` 启动

## 涉及文件

- `docker-compose.dev.yml` — 服务定义
- `package.json` — `infra:up`、`infra:down` scripts
- `.env.example` — 环境变量模板
- `.env` — 本地环境变量（gitignored）
- `.data/` — 数据卷挂载目录（gitignored）

## 相关功能

- `i-02-drizzle-orm-setup` — 消费 PostgreSQL 服务进行数据库迁移
- `i-03-minio-client` — 消费 MinIO 服务进行对象存储操作
- `i-04-milvus-client` — 消费 Milvus 服务进行向量检索
- `b-01-auth-api` — 消费 PostgreSQL + Redis 进行会话存储

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Server 不在 Docker 中运行 | 开发期间需要热重载、调试，Tauri sidecar 模式要求独立进程 | 是，后续可补充 `docker-compose.yml` 用于集成测试 |
| 数据卷挂载到 `./.data/` | 集中管理开发数据，便于清理和查看，避免 Docker 匿名卷泄漏 | 是 |
| 使用 `docker-compose.dev.yml` 而非默认文件名 | 明确区分开发/生产，避免误操作 | 是 |
| Milvus 使用 standalone 模式 | MVP 阶段单节点足够，降低资源占用 | 是，后续可切换到 cluster 模式 |
| MinIO 单节点单盘 | 开发环境简化配置，满足基本对象存储需求 | 是 |
| Redis 无持久化（或可选 RDB） | 开发环境缓存/队列数据可丢失，重启后重建即可 | 是 |

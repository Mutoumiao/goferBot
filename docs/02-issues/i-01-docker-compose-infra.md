状态: needs-triage
分类: enhancement

## 要构建的内容

搭建 Docker Compose 开发环境，包含 PostgreSQL、MinIO、Milvus、Redis 四个核心服务。

## 规格引用

- 功能规格: docs/03-specs/features/docker-compose-infra/feature-spec.md
- 行为规格: docs/03-specs/features/docker-compose-infra/behavior-spec.md
- API 规格: 无（基础设施，无 API）

## 验收标准

- [ ] `docker-compose.dev.yml` 包含 postgres、minio、milvus-standalone、redis 四个服务
- [ ] 每个服务配置正确的端口映射、环境变量、数据卷
- [ ] `pnpm infra:up` 命令可一键启动所有服务
- [ ] `pnpm infra:down` 命令可一键停止所有服务
- [ ] 启动后各服务健康检查通过（pg 可连接、minio 控制台可访问、milvus 端口监听、redis 可 ping）
- [ ] `.env.example` 包含所有需要的环境变量

## 阻塞于

- 无

## 范围外

- 生产环境部署配置
- 服务监控与告警
- 数据备份策略

## Agent 简报

**分类：** enhancement
**摘要：** 搭建 Docker Compose 开发基础设施（PG + MinIO + Milvus + Redis）

**当前行为：**
项目无基础设施服务，开发环境为空。

**期望行为：**
运行 `pnpm infra:up` 后，四个核心服务全部就绪，后续开发可依赖这些服务。

**关键接口：**
- `docker-compose.dev.yml` — 服务定义
- `package.json` scripts — `infra:up`、`infra:down`
- `.env.example` — 环境变量模板

**验收标准：**
- [ ] `docker-compose.dev.yml` 包含 postgres、minio、milvus-standalone、redis 四个服务
- [ ] 每个服务配置正确的端口映射、环境变量、数据卷
- [ ] Sidecar HTTP 端口统一使用 `port: 0`（OS 自动分配），杜绝 TOCTOU 竞态
- [ ] `pnpm infra:up` 命令可一键启动所有服务
- [ ] `pnpm infra:down` 命令可一键停止所有服务
- [ ] 启动后各服务健康检查通过
- [ ] `.env.example` 包含所有需要的环境变量

**范围外：**
- 生产环境部署配置
- 服务监控与告警
- 数据备份策略

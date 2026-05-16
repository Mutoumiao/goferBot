# 行为规格：Docker Compose 开发基础设施

## 入口

- 触发：开发者在项目根目录执行 `pnpm infra:up`
- 停止：执行 `pnpm infra:down`

## 初始状态

- 未启动时：四个服务均未运行，`docker-compose.dev.yml` 定义的服务状态为 `Exited` 或不存在
- 端口占用检查：若目标端口已被占用，`docker compose up` 将报错并提示端口冲突

## 服务启动流程

| 步骤 | 操作 | 系统响应 | 状态 |
|------|------|----------|------|
| 1 | 执行 `pnpm infra:up` | 调用 `docker compose -f docker-compose.dev.yml up -d` | starting |
| 2 | Docker Compose 解析配置 | 加载 `.env` 环境变量，创建网络 `goferbot-infra` | starting |
| 3 | 启动 PostgreSQL | 容器 `goferbot-postgres` 启动，挂载 `./.data/postgres` | starting |
| 4 | 启动 MinIO | 容器 `goferbot-minio` 启动，挂载 `./.data/minio` | starting |
| 5 | 启动 Milvus | 容器 `goferbot-milvus` 启动，挂载 `./.data/milvus` | starting |
| 6 | 启动 Redis | 容器 `goferbot-redis` 启动，挂载 `./.data/redis` | starting |
| 7 | 健康检查轮询 | Docker 内置 healthcheck 逐服务检查 | healthy / unhealthy |
| 8 | 全部 healthy | 命令退出码 0，终端输出服务状态摘要 | running |

## 健康检查流程

| 服务 | 检查命令 | 间隔 | 超时 | 重试次数 | 通过条件 |
|------|----------|------|------|----------|----------|
| PostgreSQL | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` | 10s | 5s | 5 | 返回码 0 |
| MinIO | `mc admin info local`（或 `curl -f http://localhost:9000/minio/health/live`） | 10s | 5s | 5 | HTTP 200 |
| Milvus | `curl -f http://localhost:9091/healthz`（或端口 19530 监听检查） | 15s | 10s | 10 | HTTP 200 / 端口连通 |
| Redis | `redis-cli ping` | 10s | 5s | 5 | 返回 `PONG` |

> 注：Milvus standalone 启动较慢（约 30-60s），需配置较长的启动时间和重试次数。

## 故障恢复

| 场景 | 触发 | 行为 | 恢复方式 |
|------|------|------|----------|
| 端口冲突 | 目标端口已被其他进程占用 | `docker compose up` 报错，容器创建失败 | 释放占用端口或修改 `.env` 中的端口映射 |
| 磁盘空间不足 | 数据卷所在分区剩余空间 < 1GB | 容器启动失败或写入报错 | 清理 `./.data/` 或扩展磁盘空间 |
| 服务启动超时 | Milvus 等资源密集型服务启动慢 | healthcheck 重试耗尽，容器标记 unhealthy | 增加 Docker 内存/CPU 配额，执行 `pnpm infra:down` 后重试 |
| 配置错误 | `.env` 中数据库密码/密钥不匹配 | 对应服务启动失败，日志输出认证/配置错误 | 检查 `.env` 与 `docker-compose.dev.yml` 环境变量一致性 |
| 数据卷损坏 | 异常关机导致数据文件损坏 | PostgreSQL/Milvus 启动崩溃 | 删除 `./.data/<service>` 目录重新初始化（开发环境数据可丢弃） |
| 网络冲突 | `goferbot-infra` 网段与本地网络冲突 | 容器间通信异常 | 修改 `docker-compose.dev.yml` 中网络配置 |

## 资源占用预期

| 服务 | 内存 | CPU | 磁盘（初始） |
|------|------|-----|-------------|
| PostgreSQL | ~100MB | 低 | ~50MB |
| MinIO | ~150MB | 低 | ~10MB |
| Milvus standalone | ~1.5GB | 中 | ~100MB |
| Redis | ~50MB | 低 | ~1MB |
| **总计** | **~1.8GB** | **中** | **~160MB** |

> 建议开发机器至少预留 4GB 内存给 Docker，以保证 Milvus 稳定运行。

## 停止流程

| 步骤 | 操作 | 系统响应 | 状态 |
|------|------|----------|------|
| 1 | 执行 `pnpm infra:down` | 调用 `docker compose -f docker-compose.dev.yml down` | stopping |
| 2 | 停止容器 | 按依赖顺序优雅停止各服务容器 | exited |
| 3 | 保留数据卷 | `./.data/` 目录内容保留，下次启动数据仍在 | stopped |
| 4 | 可选：清理卷 | `pnpm infra:down --volumes` 将同时删除命名卷 | clean |

## 环境变量清单（`.env.example`）

```bash
# ==========================================
# Docker Compose 基础设施环境变量
# ==========================================

# --- PostgreSQL ---
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=gofer
POSTGRES_PASSWORD=gofer_dev_pass
POSTGRES_DB=goferbot

# --- MinIO ---
MINIO_HOST=localhost
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_BUCKET=goferbot

# --- Milvus ---
MILVUS_HOST=localhost
MILVUS_PORT=19530
MILVUS_METRIC_PORT=9091

# --- Redis ---
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## 脚本实现

```json
// package.json scripts
{
  "infra:up": "docker compose -f docker-compose.dev.yml up -d --wait",
  "infra:down": "docker compose -f docker-compose.dev.yml down",
  "infra:logs": "docker compose -f docker-compose.dev.yml logs -f",
  "infra:reset": "docker compose -f docker-compose.dev.yml down -v && rm -rf .data"
}
```

## 数据持久化策略

- PostgreSQL：`./.data/postgres:/var/lib/postgresql/data`
- MinIO：`./.data/minio:/data`
- Milvus：`./.data/milvus:/var/lib/milvus`
- Redis：`./.data/redis:/data`（可选，开发环境可关闭持久化）

`.data/` 目录已加入 `.gitignore`，确保开发数据不会提交到版本控制。

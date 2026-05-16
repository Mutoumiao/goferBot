# Docker Compose 基础设施测试用例

## TC-01: pnpm infra:up 启动四个服务
- **触发**: 运行 `pnpm infra:up`
- **预期**: docker-compose 启动 postgres、minio、milvus、redis
- **验证**: `docker compose -f docker-compose.dev.yml ps` 显示 4 个容器 running

## TC-02: PostgreSQL 健康检查通过
- **触发**: 服务启动后 10 秒
- **预期**: pg_isready 返回 0
- **验证**: `docker compose -f docker-compose.dev.yml exec postgres pg_isready -U postgres`

## TC-03: MinIO 控制台可访问
- **触发**: 服务启动后
- **预期**: `http://localhost:9001` 返回登录页
- **验证**: `curl -s -o /dev/null -w "%{http_code}" http://localhost:9001` 返回 200

## TC-04: Milvus 端口监听
- **触发**: 服务启动后 60 秒（Milvus 启动较慢）
- **预期**: 端口 19530 可连接
- **验证**: `nc -z localhost 19530` 返回 0

## TC-05: Redis 可 ping
- **触发**: 服务启动后
- **预期**: redis-cli ping 返回 PONG
- **验证**: `docker compose -f docker-compose.dev.yml exec redis redis-cli ping`

## TC-06: pnpm infra:down 停止所有服务
- **触发**: 运行 `pnpm infra:down`
- **预期**: 所有容器停止并移除
- **验证**: `docker compose -f docker-compose.dev.yml ps` 显示空

## TC-07: 数据卷持久化
- **触发**: infra:up → 创建数据 → infra:down → infra:up
- **预期**: PostgreSQL 数据仍然存在
- **验证**: 第二次启动后之前创建的 database 仍存在

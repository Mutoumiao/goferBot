# API 规格：NestJS 服务器初始化

## 端点

### GET /health

健康检查端点，用于部署验证和监控探针。该端点不受全局 `/api` 前缀影响，直接挂载在根路径。

#### 认证
无

#### 请求
无需请求体，无查询参数。

#### 响应 200
```json
{
  "status": "ok",
  "timestamp": "2026-05-16T12:34:56.789Z",
  "version": "0.1.0"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `string` | 固定值 `"ok"`，表示服务正常运行 |
| `timestamp` | `string` | ISO 8601 格式的当前服务器时间 |
| `version` | `string` | 服务端版本号，读取自 `package.json` 的 `version` 字段 |

#### 错误码
| 码 | 场景 | 响应体 |
|------|------|--------|
| 500 | 服务内部异常（理论上不应发生，因健康检查不依赖外部服务） | `{ "statusCode": 500, "message": "Internal server error" }` |

#### 异步行为
无。该端点为同步响应，不依赖数据库、Redis 或其他外部服务。

#### 验收验证
```bash
curl http://localhost:3000/health
```
期望返回 HTTP 200，响应体包含 `status: "ok"`、`timestamp`、`version` 字段。

---

## 全局响应格式约定

所有受全局响应拦截器影响的业务端点（挂载在 `/api` 前缀下），成功响应统一包装为：

```json
{
  "data": { ... }
}
```

错误响应由全局异常过滤器统一处理，格式为：

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## 全局配置参数

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| 服务端口 | `PORT` | `3000` | NestJS 监听端口 |
| 全局前缀 | — | `/api` | 所有控制器路由前缀（健康检查除外） |
| CORS 来源 | `CORS_ORIGIN` | `*` | 开发环境允许所有来源 |
| 日志级别 | `LOG_LEVEL` | `log` | NestJS 内置日志级别 |

## 依赖模块接口（占位）

以下模块在初始化阶段建立占位，后续 issue 逐步填充实现：

### DatabaseModule
- 导出：`PrismaService`
- 职责：提供 Prisma Client 实例，供各业务模块注入使用
- 后续由 i-02-prisma-setup 完善

### CacheModule
- 导出：`CacheService`
- 职责：封装 Redis 操作，提供键值缓存、TTL 管理
- 后续由 redis-bullmq-setup 完善

### HelperModule
- 导出：`HelperService`
- 职责：提供通用工具方法（加密、哈希、日期格式化等）
- 后续随业务需求扩展

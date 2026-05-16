# V1 清理测试用例

## TC-01: sync.ts 已删除且无引用
- **触发**: 全局搜索 `sync.ts` 引用
- **预期**: 无 import 语句引用 `sync.ts`
- **验证**: `grep -r "from './sync.js'" packages/server/src/` 返回空

## TC-02: better-sqlite3 依赖已移除
- **触发**: 检查 `packages/server/package.json`
- **预期**: `dependencies` 中不含 `better-sqlite3`、`sqlite-vec`
- **验证**: `cat packages/server/package.json | grep -E "better-sqlite3|sqlite-vec"` 返回空

## TC-03: db.ts 保留框架但无 better-sqlite3 代码
- **触发**: 读取 `packages/server/src/db.ts`
- **预期**: 文件存在，但不含 `import Database from 'better-sqlite3'`
- **验证**: `grep "better-sqlite3" packages/server/src/db.ts` 返回空

## TC-04: 路由文件返回 501
- **触发**: 访问 `/knowledge-bases`、`/sessions`、`/chat`、`/settings`
- **预期**: 所有路由返回 `{ "error": "Not implemented" }` 状态码 501
- **验证**: `curl -s http://localhost:3000/knowledge-bases | grep "Not implemented"`

## TC-05: pnpm dev:server 正常启动
- **触发**: 运行 `pnpm dev:server`
- **预期**: Server 启动成功，不报错
- **验证**: 控制台输出 `Server running on http://0.0.0.0:3000`

## TC-06: pnpm type-check 通过
- **触发**: 运行 `pnpm type-check`
- **预期**: 无 TypeScript 错误
- **验证**: 命令退出码为 0

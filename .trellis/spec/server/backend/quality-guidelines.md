# Quality Guidelines

> GoferBot 代码质量标准与禁止模式

---

## 代码格式化（biome.json — 单一真源）

| 规则 | 值 |
|------|-----|
| 缩进 | 2 spaces |
| 引号 | **单引号** `'` |
| 分号 | **无** |
| 行宽 | 100 字符 |
| 尾逗号 | **总是**添加 |
| 箭头函数括号 | **总是**添加 |
| 换行符 | LF |

```bash
# 格式化
pnpm biome format --write .

# Lint
pnpm biome lint .

# CI 检查
pnpm biome ci .
```

---

## Import 组织

```json
"assist": {
  "actions": {
    "source": { "organizeImports": "on" }
  }
}
```

保存时自动排序 import，**不需要手动管理 import 顺序**。

---

## Lint 规则分层

### 全局规则

```json
"rules": {
  "preset": "recommended",
  "domains": { "react": "recommended", "test": "recommended" }
}
```

### 包级别覆盖

| 包 | 特殊规则 | 原因 |
|----|---------|------|
| `packages/server/**` | noBannedTypes off, noStaticOnlyClass off, noExplicitAny off | NestJS DI 装饰器模式 |
| `packages/admin/**` | a11y off, noExplicitAny off, noUselessTernary off | 管理后台灵活度 |
| `packages/web/**` | a11y off, noExplicitAny warn, complexity off | 用户端体验优先 |
| `tests/**` | noConsole off, noExplicitAny off, noUnusedFunctionParameters off | 测试灵活性 |

---

## 排除文件

```
dist/          — 构建产物
coverage/      — 测试覆盖率
test-results/  — 测试结果
.data/         — 运行时数据
*.gen.ts       — 自动生成代码
prisma/migrations/ — Prisma 迁移文件（由 Prisma 自动维护）
docs/          — 文档
node_modules/  — 第三方依赖
```

---

## 架构约束（禁止模式）

### NestJS 模块

| 做 | 不做 |
|----|------|
| ✅ `@Global()` 用于基础设施模块 | ❌ 业务模块标记 `@Global()` |
| ✅ `forwardRef()` 解决循环依赖 | ❌ 直接相互注入造成循环依赖 |
| ✅ DynamicModule.forRoot() 传配置 | ❌ 在 @Module() 内部读取 ConfigService |
| ✅ `@Optional()` 处理可选依赖 | ❌ 必选依赖不加 `@Optional()` |

### 数据访问

| 做 | 不做 |
|----|------|
| ✅ 跨模块数据访问走 Repository 导出 | ❌ 模块间直接注入彼此的 Service |
| ✅ 事务操作走 TransactionManager | ❌ 直接调用 `prisma.$transaction()` |
| ✅ bcrypt 在事务外执行 | ❌ 耗时操作放在事务内 |
| ✅ 大文本用 BigInt 存储 size | ❌ 在 DB 中存储文件二进制内容 |

### 安全

| 做 | 不做 |
|----|------|
| ✅ 密码通过 bcrypt 哈希 | ❌ 明文存储或自创哈希方案 |
| ✅ API Key 加密存储 | ❌ 日志中输出密钥/令牌 |
| ✅ 生产模式隐藏 error details | ❌ 生产环境返回堆栈信息 |
| ✅ 请求体走 Zod 校验 | ❌ 信任未校验的 `req.body` |

### 异步处理

| 做 | 不做 |
|----|------|
| ✅ 重任务走 BullMQ 队列 | ❌ 在 HTTP 请求中执行索引/重排 |
| ✅ Worker 失败更新状态为 failed | ❌ Worker 失败不更新状态 |
| ✅ Redis 不可用时降级不崩溃 | ❌ Redis 不可用时抛异常阻止启动 |

### API 设计

| 做 | 不做 |
|----|------|
| ✅ Controller → Service → Repository 分层 | ❌ Controller 直接操作数据库 |
| ✅ Zod Schema 在 data 包共享 | ❌ 前后端各自定义验证规则 |
| ✅ 分页走 PaginationResult<T> 统一格式 | ❌ 各自实现分页逻辑 |

---

## 不要做的事

- ❌ 提交包含 `console.log` 的代码（biome recommended 规则会拦截）
- ❌ 引入未在 package.json 中声明的隐式依赖
- ❌ 绕过 biome.json 的 overrides 规则
- ❌ 在 `prisma/migrations/` 中手动修改迁移文件
- ❌ 使用 `any` 类型（server 除外，通过 overrides 关闭）

## Common Mistakes

1. **忘记 organizeImports**：保存前确保 biome 自动执行了 import 排序
2. **覆盖 rules 后不写注释**：每个 overrides 块应注明原因
3. **CI 检查失败后本地不修复**：`biome ci` 失败应立即在本地 `biome lint --write` 修复

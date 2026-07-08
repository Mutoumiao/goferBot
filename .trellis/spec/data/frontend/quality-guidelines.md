# 代码标准和禁止模式

> Data Schema 包的代码质量标准、禁止模式和最佳实践。

---

## 概述

`packages/data` 是一个纯 TypeScript Schema 包，其代码质量直接影响前后端的数据验证和类型安全。本指南定义了该包的代码标准和禁止模式。

---

## 代码标准

### 文件结构

每个 Schema 文件应遵循以下结构：

```typescript
import { z } from 'zod'

// 1. 枚举定义（如果有）
export const statusSchema = z.enum(['active', 'disabled', 'deleted'])

// 2. 辅助函数（如果有）
function toBoolean(value: unknown): boolean | undefined { /* ... */ }

// 3. 基础实体 Schema
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
})

// 4. 请求体 Schema
export const createUserRequestSchema = z.object({
  name: z.string().min(1, '名称不能为空'),
})

// 5. 响应体 Schema
export const userResponseSchema = z.object({
  data: userSchema,
})

// 6. 派生类型（可选）
export type User = z.infer<typeof userSchema>
```

### 命名规范

| 类型 | 命名模式 | 示例 |
|------|---------|------|
| Schema 变量 | 驼峰 + `Schema` 后缀 | `userSchema`, `createUserRequestSchema` |
| 类型别名 | PascalCase | `User`, `CreateUserRequest` |
| 枚举 Schema | 驼峰 + `Schema` 后缀 | `userRoleSchema`, `documentStatusSchema` |
| 常量 | 全大写蛇形 | `MEMORY_INJECTION_LIMIT`, `MEMORY_KEYWORD_REGEX` |

### 错误消息

错误消息必须使用**中文**，清晰描述问题：

```typescript
// 推荐
z.string().min(1, '文件名不能为空').max(255, '文件名过长')
z.string().email('邮箱格式不正确')

// 避免
z.string().min(1).max(255)
z.string().email()
```

### 注释规范

- 使用 JSDoc 注释说明 Schema 的用途
- 复杂的 `.refine()` 逻辑需要注释说明
- 导出的常量需要注释说明含义

```typescript
/**
 * 分页请求参数 Schema — 前后端共享的通用分页参数
 * @description 用于所有需要分页的列表查询接口
 */
export const pagerRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码，最小 1'),
})
```

---

## 禁止模式

### 类型安全

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| `z.any()` | 使用 `any` 绕过类型检查 | 使用明确类型或 `z.unknown()` |
| `z.unknown()` 无后续验证 | 直接使用 `z.unknown()` | 添加 `.refine()` 或转换 |
| `as any` | 类型断言绕过检查 | 使用 `z.infer` 或明确类型 |

### Schema 设计

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| 省略错误消息 | `.min(1)` 不提供错误消息 | `.min(1, '错误消息')` |
| 字符串无长度限制 | `z.string()` 无 `.max()` | 添加合理的 `.max()` 限制 |
| 数字无范围限制 | `z.number()` 无 `.min()`/`.max()` | 添加范围限制 |
| 重复定义 Schema | 多个地方定义相同结构 | 提取为共享 Schema |
| 硬编码默认值 | 在代码中硬编码默认值 | 使用 `.default()` |

### 代码组织

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| 单文件过长 | Schema 文件超过 200 行 | 拆分为多个文件 |
| 复杂逻辑内联 | 在 `.refine()` 中写复杂逻辑 | 提取为独立函数 |
| 未使用的 Schema | 定义了但未导出或使用 | 删除或导出 |
| 未导出的工具函数 | 内部函数未导出 | 导出供其他模块使用 |
| 跨层响应类型未在 `@goferbot/data` 定义 | Admin/Server 响应类型（如 `FetchModelsResult`、`ProviderPreset`）在 server 和 admin 各自定义 interface，未使用 Zod Schema 共享 | 在 `@goferbot/data` 中定义 Zod Schema + 导出类型，确保前后端类型一致 |
| Server DTO 重复定义 `@goferbot/data` 中已有的 Schema | `packages/server/.../dto/settings.dto.ts` 本地定义了与 `@goferbot/data` 完全相同的 `modelSchema`/`modelProviderSchema`/`settingsSchema` | 从 `@goferbot/data` 导入 Schema，使用 `createZodDto(schema)` 生成 DTO |
| 前后端共享常量未在 `@goferbot/data` 定义 | 角色权限映射（`ROLE_PERMISSIONS`）、权限码常量（`PERMISSIONS`）、角色标签等仅在 `packages/admin` 中硬编码，server 侧无访问 | 将共享常量迁移到 `packages/data/src/constants/`，前后端统一导入 |
| 权限常量与后端 seeder 不一致 | 前端定义的 `PERMISSIONS` 常量数量或值与后端 `permission.seeder.ts` 不匹配 | 前端权限常量必须与后端 seeder 完全对齐，修改 seeder 后同步更新 `@goferbot/data` |

### 安全

| 禁止 | 描述 | 正确做法 |
|------|------|----------|
| 密码明文验证 | `password: z.string()` 无长度限制 | 添加 `.min(8)` 和 `.max(128)` |
| 敏感信息日志 | 在错误消息中包含敏感信息 | 日志中脱敏处理 |
| 正则表达式安全 | 使用不安全的正则表达式 | 使用安全的正则模式 |

---

## 最佳实践

### 字符串长度限制

根据业务需求设置合理的长度限制：

| 场景 | 推荐长度 | 示例 |
|------|---------|------|
| 用户名/昵称 | 1-50 | `.min(1).max(50)` |
| 邮箱 | 无上限 | `.email()` |
| 标题 | 1-200 | `.min(1).max(200)` |
| 描述 | 0-2000 | `.max(2000)` |
| 富文本内容 | 0-5,000,000 | `.max(5_000_000)` |
| 密码 | 8-128 | `.min(8).max(128)` |

### 数字范围限制

```typescript
// 百分比
z.number().min(0).max(100)

// 温度参数
z.number().min(0).max(2, 'temperature 范围 0-2')

// 分页大小
z.coerce.number().int().min(1).max(100)

// ID（非负整数）
z.coerce.number().int().min(0)
```

### 日期字段处理

JSON 序列化时日期通常为字符串，推荐使用 `z.string()` 配合 ISO 日期格式：

```typescript
// 推荐
export const userSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
})

// 在业务层解析
const createdAt = new Date(user.createdAt)
```

### 可选字段处理

区分 `.optional()` 和 `.nullable()`：

```typescript
export const userSchema = z.object({
  // 字段可能不存在
  avatarUrl: z.string().optional(),
  
  // 字段存在但可能为 null
  deletedAt: z.string().nullable(),
  
  // 字段可能不存在或为 null
  phone: z.string().nullable().optional(),
})
```

### 枚举复用

将枚举提取为独立变量，便于复用和维护：

```typescript
export const userRoleSchema = z.enum(['USER', 'ADMIN'])

export const userSchema = z.object({
  role: userRoleSchema.default('USER'),
})

export const updateUserRequestSchema = z.object({
  role: userRoleSchema.optional(),
})
```

### Schema 复用

使用 `.partial()`、`.omit()`、`.pick()` 等方法复用 Schema：

```typescript
export const createUserRequestSchema = userSchema.omit({ id: true, createdAt: true, updatedAt: true })
export const updateUserRequestSchema = createUserRequestSchema.partial()
```

---

## 质量检查清单

### 新增 Schema 时

- [ ] 所有字段有明确类型
- [ ] 必填字段有验证规则（`.min(1)`、`.email()` 等）
- [ ] 错误消息使用中文
- [ ] 字符串字段有合理的长度限制（`.max()`）
- [ ] 数字字段有合理的范围限制（`.min()`/`.max()`）
- [ ] 可选字段使用 `.optional()`
- [ ] Schema 在 `index.ts` 中导出
- [ ] 派生类型使用 `z.infer<typeof schema>`

### 修改 Schema 时

- [ ] 检查是否影响其他模块
- [ ] 更新相关的错误消息
- [ ] 检查默认值是否需要调整
- [ ] 更新对应的 TypeScript 类型

### 删除 Schema 时

- [ ] 检查是否有其他模块引用
- [ ] 从 `index.ts` 中移除导出
- [ ] 删除相关的 TypeScript 类型

---

## 工具集成

### Biome

项目使用 Biome 进行代码格式化和 lint：

```bash
pnpm --filter @goferbot/data lint
pnpm --filter @goferbot/data format
```

### TypeScript

项目使用 strict 模式：

```bash
pnpm --filter @goferbot/data type-check
```

### 构建

```bash
pnpm --filter @goferbot/data build
```

---

## 常见错误

1. **忘记导出 Schema**：确保所有 Schema 在 `index.ts` 中导出
2. **缺少错误消息**：使用 `.min(1)` 而不是 `.min(1, '错误消息')`
3. **字符串无长度限制**：可能导致 DoS 攻击或数据库溢出
4. **可选字段处理不当**：混淆 `.optional()` 和 `.nullable()`
5. **日期字段使用 `z.date()`**：JSON 序列化时会导致问题
6. **Schema 定义后未使用**：增加维护负担
7. **错误消息使用英文**：不符合项目规范
8. **工具函数未导出**：无法被其他模块复用
9. **跨层响应类型未定义为 Zod Schema**：`@goferbot/data` 包是前后端共享契约的**唯一权威源**。所有跨层消费的请求/响应类型（如 `FetchModelsResult`、`FetchedModel`、`ProviderPreset`）MUST 在此定义为 Zod Schema 并导出 `z.infer` 类型。禁止在 server 和 admin 两端各自定义 interface — 这会导致类型不一致且无法被 `nestjs-zod` 的 `ZodValidationPipe` 校验。
10. **Server DTO 独立定义与 `@goferbot/data` 重复的 Schema**：如 `packages/server/.../dto/settings.dto.ts` 中重新定义了 `modelSchema`/`modelProviderSchema`/`settingsSchema`，这些 Schema 已在 `@goferbot/data` 中定义。重复定义导致"单一真源"原则被破坏，修改一处 Schema 时可能遗漏同步另一处。Server DTO MUST 从 `@goferbot/data` 导入 Schema，使用 `createZodDto(schema)` 模式生成 DTO 类。
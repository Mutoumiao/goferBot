# 架构合规审查记录

> 后端代码审查时的架构合规检查清单。
>
> **使用时机**：
> - `/kb-review` 执行代码审查时
> - issue 关闭前最终验收时
> - 任何涉及架构决策变更的代码审查时

---

## 审查信息

| 项目 | 内容 |
|------|------|
| 审查日期 | {YYYY-MM-DD} |
| 审查对象 | {issue 编号 / PR / 分支} |
| 审查类型 | {代码审查 / 关闭前验收 / 架构变更审查} |
| 审查人 | {Agent / 开发者} |

---

## 一、ADR 合规检查

### 涉及的 ADR

| ADR | 涉及内容 | 状态 | 说明 |
|-----|---------|------|------|
| ADR 0004 | 验证方案、响应格式、技术栈 | ✅/❌/— | |
| ADR 0005 | 向量存储（pgvector） | ✅/❌/— | |
| {其他 ADR} | | | |

### 验证方案合规

- [ ] **所有 DTO 使用 Zod schema + `createZodDto`**
- [ ] **无 `class-validator` 装饰器**（`@IsString`、`@IsInt` 等）
- [ ] **无 `class-transformer` 使用**（`@Type`、`@Transform` 等）
- [ ] **无 `@UsePipes(new ValidationPipe(...))`**（NestJS 原生 ValidationPipe）
- [ ] **无 `class-validator` / `class-transformer` 依赖引入**

**检查结果**：✅ 合规 / ❌ 违规

**违规详情**（如有）：
- 位置：`{文件路径:行号}`
- 问题：{具体描述}
- 修复建议：{如何修复}

---

### 响应格式合规

- [ ] **所有 API 端点直接返回原始数据**（不手动包装 `{ data: ... }`）
- [ ] **无无正当理由的 `@BypassResponse()`**
- [ ] **SSE 流式响应是唯一的 `@BypassResponse()` 合法场景**
- [ ] **分页接口返回 `{ data: { items, pagination } }` 嵌套结构**

**检查结果**：✅ 合规 / ❌ 违规

**违规详情**（如有）：
- 位置：`{文件路径:行号}`
- 问题：{具体描述}
- 修复建议：{如何修复}

---

### 依赖引入合规

- [ ] **无与现有技术栈冲突的新依赖**
- [ ] **无已明确禁止的依赖**（class-validator、class-transformer 等）
- [ ] **新依赖有明确的必要性说明**

**检查结果**：✅ 合规 / ❌ 违规

**新增依赖清单**（如有）：
| 包名 | 版本 | 用途 | 是否必要 |
|------|------|------|----------|
| | | | |

---

## 二、后端专项合规

### NestJS 规范

- [ ] 模块/控制器/服务分层清晰
- [ ] API 端点遵循 RESTful 规范
- [ ] 认证使用 `@UseGuards(JwtAuthGuard)` + `@CurrentUser()`
- [ ] 数据库操作使用 `PrismaService` 注入
- [ ] 需要事务时使用 Prisma `$transaction`

### DTO 规范

- [ ] DTO 使用标准模板（`z.object` + `createZodDto`）
- [ ] 查询参数使用 `z.coerce` 处理类型转换
- [ ] 布尔值查询参数使用 `z.union` + `transform` 模式
- [ ] 字段有 `.describe()` 描述

### 错误处理规范

- [ ] Service 层抛出 NestJS 内置异常
- [ ] 错误响应使用 `{ code, message }` 结构
- [ ] 无内部错误信息泄露

---

## 三、审查结论

| 维度 | 结果 | 说明 |
|------|------|------|
| ADR 合规 | ✅ 通过 / ❌ 不通过 | |
| 验证方案 | ✅ 通过 / ❌ 不通过 | |
| 响应格式 | ✅ 通过 / ❌ 不通过 | |
| 依赖引入 | ✅ 通过 / ❌ 不通过 | |

### 总体结论

- [ ] **通过**：所有检查项合规，无需修改
- [ ] **有条件通过**：存在 Minor 问题，建议修复但不阻塞
- [ ] **不通过**：存在 Critical/Major 违规，必须修复后才能继续

### 问题汇总

#### 🔴 Critical（阻塞）
1. {问题描述} — {位置} — {修复建议}

#### 🟠 Major（重要）
1. {问题描述} — {位置} — {修复建议}

#### 🟡 Minor（轻微）
1. {问题描述} — {位置} — {修复建议}

---

## 四、修复确认

| 问题 | 修复状态 | 验证人 | 日期 |
|------|---------|--------|------|
| | | | |

**最终确认**：所有 Critical/Major 问题已修复，审查通过。

---

## 附录：常见违规模式速查

| 违规模式 | 正确做法 | 严重级别 |
|---------|---------|---------|
| 使用 `@IsString()` 等 class-validator 装饰器 | 使用 `z.string()` | Critical |
| `@UsePipes(new ValidationPipe(...))` | 移除，全局 ZodValidationPipe 自动生效 | Critical |
| `@BypassResponse()` 无正当理由 | 移除，让 ResponseInterceptor 包装 | Major |
| 手动返回 `{ data: result }` | 直接 `return result` | Major |
| 引入 `class-validator` 依赖 | 移除，使用 Zod 替代 | Critical |
| DTO 不使用 `createZodDto` | 改为 `class XxxDto extends createZodDto(schema)` | Major |
| 查询参数不使用 `z.coerce` | 使用 `z.coerce.number()` 处理 URL 参数 | Minor |

---
name: architecture-guard
description: >
  架构合规守卫。在 spec、plan、开发前、代码审查阶段自动扫描 ADR 违规模式。
  当用户说"检查架构合规"、"ADR 合规吗"、"有没有用 class-validator"、
  "扫描违规"、"合规检查"、"审查代码是否符合架构"时触发。
  也应在 plan-generator、spec-validator、dev-orchestrator、kb-review 执行前自动调用。
---

# 架构合规守卫

## 执行摘要

| 项目 | 内容 |
|------|------|
| **触发词** | "检查架构合规"、"ADR 合规吗"、"扫描违规"、"有没有 class-validator" |
| **硬关卡** | Critical 违规必须修复后才能继续 |
| **核心输出** | 分级违规列表（Critical/Major/Minor）+ 自动修复建议 |
| **禁止行为** | 发现 Critical 违规仍继续生成 plan/spec/代码 |
| **下一步** | 违规修复后重新扫描 → 通过后方可继续 |

**核心理念**：ADR 违规如果在编码后才发现，修复成本是编码前的 10 倍。本 skill 作为**前置闸门**，在 spec、plan、代码进入下一阶段前拦截违规。

**开始时声明：** "正在使用 architecture-guard skill 执行架构合规扫描。"

---

## 扫描时机

| 阶段 | 调用方 | 扫描目标 | 阻断级别 |
|------|--------|----------|----------|
| Spec 编写后 | spec-validator | `docs/issues/{dir}/specs/*.md` | Major |
| Plan 生成后 | plan-generator | `docs/issues/{dir}/plan.md` | Critical |
| 开发前 | dev-orchestrator | `docs/issues/{dir}/plan.md` + 相关代码 | Critical |
| 代码审查时 | kb-review | `git diff` 或指定文件的变更 | Critical |
| 用户主动要求 | 直接调用 | 用户指定的文件或目录 | 按发现级别 |

---

## 扫描维度

### 规范阅读协议（执行扫描前必读）

**本 skill 不重复定义规范，所有规范定义以以下文档为唯一真相源：**

| 文档 | 内容 | 读取方式 |
|------|------|----------|
| `docs/adrs/0001-cloud-native-architecture.md` | ADR 0001 架构决策（验证方案、响应格式、技术栈） | 扫描前必读 |
| `docs/guide/backend/conventions.md` | 后端编码规范（DTO 模板、常见违规速查、检查清单） | 扫描前必读 |
| `docs/guide/backend/architecture-compliance.md` | 架构合规审查记录模板 | 参考 |

**扫描执行方式：**
1. 阅读上述规范文档，建立检查标准
2. 对照规范逐条检查扫描目标
3. 输出违规列表，按 Critical/Major/Minor 分级

---

### 维度 1：验证方案合规（最高优先级）

**决策来源**：ADR 0001 — 所有 DTO 必须使用 Zod schema + `createZodDto`，禁止 class-validator/class-transformer

**检查标准（详见 `conventions.md` 验证方案章节）：**
- 所有 DTO 必须继承 `createZodDto()`
- 禁止 `class-validator` 装饰器（`@IsString`、`@IsInt` 等）
- 禁止 `class-transformer` 装饰器（`@Type`、`@Transform` 等）
- 禁止 `@UsePipes(new ValidationPipe(...))`
- 查询参数使用 `z.coerce` 处理类型转换

**违规模式清单：**

| 违规模式 | 严重级别 | 关键词 |
|----------|----------|--------|
| 使用 `@IsString()`、`@IsInt()` 等 class-validator 装饰器 | 🔴 Critical | `@Is\w+\(` |
| 使用 `@Type(() => Number)` 等 class-transformer 装饰器 | 🔴 Critical | `@Type\(` |
| 使用 `@Transform()` 装饰器 | 🔴 Critical | `@Transform` |
| 手动实例化 `ValidationPipe` | 🔴 Critical | `ValidationPipe` |
| DTO 类不继承 `createZodDto()` | 🟠 Major | `class \w+Dto` 且无 `extends createZodDto` |
| 查询参数未使用 `z.coerce` | 🟡 Minor | `@Query` 参数无 `z.coerce` |

---

### 维度 2：响应格式合规

**决策来源**：ADR 0001 — 所有 API 成功响应统一为 `{ data: T }` 格式，由 ResponseInterceptor 自动包装

**检查标准（详见 `conventions.md` 响应格式章节）：**
- Controller 直接返回原始数据，禁止手动包装 `{ data: result }`
- 禁止无正当理由的 `@BypassResponse()`
- 唯一合法豁免：SSE 流式响应（`chat.controller.ts`）

**违规模式清单：**

| 违规模式 | 严重级别 | 关键词 |
|----------|----------|--------|
| 无正当理由使用 `@BypassResponse()` | 🟠 Major | `@BypassResponse` |
| Controller 中手动返回 `{ data: result }` | 🟠 Major | `return \{ data:` |
| SSE 外使用 `@BypassResponse()` | 🔴 Critical | `@BypassResponse` 且非 SSE |

---

### 维度 3：依赖引入合规

**决策来源**：ADR 0001 + 技术栈约束

**禁止依赖清单：**

| 包名 | 严重级别 | 原因 |
|------|----------|------|
| `class-validator` | 🔴 Critical | ADR 0001 明确禁止 |
| `class-transformer` | 🔴 Critical | ADR 0001 明确禁止 |
| `@nestjs/class-validator` | 🔴 Critical | class-validator 包装 |
| `@nestjs/class-transformer` | 🔴 Critical | class-transformer 包装 |

---

### 维度 4：NestJS 规范合规

**检查标准（详见 `conventions.md` 相关章节）：**
- 通过 `PrismaService` 注入，禁止直接实例化 `PrismaClient`
- Service 层抛出 NestJS 内置异常，禁止 Controller 手动构造错误响应
- 敏感端点使用 `@UseGuards(JwtAuthGuard)`

**违规模式清单：**

| 违规模式 | 严重级别 | 正确做法 |
|----------|----------|----------|
| 直接实例化 `PrismaClient` | 🟠 Major | 通过 `PrismaService` 注入 |
| Controller 手动构造错误响应 | 🟠 Major | Service 层抛出 NestJS 内置异常 |
| 敏感端点无 `@UseGuards(JwtAuthGuard)` | 🔴 Critical | 所有非公开端点必须加守卫 |

---

## 扫描执行流程

### 步骤 1：阅读规范文档

扫描前，先阅读规范建立检查标准：

```
architecture-guard 启动
    ↓
阅读 docs/adrs/0001-cloud-native-architecture.md（ADR 决策）
阅读 docs/guide/backend/conventions.md（编码规范）
    ↓
建立检查标准 → 进入步骤 2
```

### 步骤 2：确定扫描范围

```
用户指定文件/目录
    ↓
若是 plan.md → 扫描其中所有代码块 + 自动扫描引用的 specs/*.md
若是 spec.md → 扫描其中的 DTO 定义、依赖声明
若是代码文件 → 扫描文件内容 + 同目录 package.json
若是 git diff → 扫描变更内容 + 优先扫描新增/修改文件
```

**自动推断规则：**

| 扫描目标 | 自动关联扫描 | 原因 |
|----------|-------------|------|
| `plan.md` | 同目录 `specs/*.md` | plan 中的代码示例可能引用 spec 中的 DTO |
| `specs/api-spec.md` | 同目录 `plan.md` | DTO 定义可能在 plan 的代码块中实现 |
| `packages/server/src/**/*.ts` | 同目录或上级 `package.json` | 检查是否引入禁止依赖 |
| `git diff` | diff 中涉及的所有文件 | 变更可能跨多个文件 |

### 步骤 3：执行扫描

对照步骤 1 建立的检查标准，逐条检查扫描目标。

**扫描原则：**
- 不依赖硬编码的 grep 命令
- 基于已阅读的规范文档，逐行审查代码逻辑
- 对疑似违规代码，追溯其是否符合 ADR 决策

### 步骤 4：分级输出

```markdown
## 架构合规扫描报告

- **扫描对象**：`docs/issues/b-14-admin-user-management/plan.md`
- **扫描时间**：2026-06-04
- **总体结论**：❌ 不通过（存在 Critical 违规）

### 🔴 Critical（必须修复）

1. **使用 class-validator 装饰器**
   - 位置：`plan.md:397`（任务 3 步骤 1）
   - 违规代码：`@IsOptional()`、`@Type(() => Number)`、`@IsInt()`
   - 正确做法：使用 `z.coerce.number().int().min(1).default(1)`
   - 依据：ADR 0001 验证方案决策
   - 自动修复：可用 `createZodDto(pagerSchema)` 模式替换

2. **Admin DTO 使用 class-validator**
   - 位置：`plan.md:1087-1100`（任务 8 步骤 3）
   - 违规代码：`@IsOptional()`、`@IsString()`、`@IsBoolean()`
   - 正确做法：使用 `z.object({...})` + `createZodDto()`
   - 依据：ADR 0001 验证方案决策

### 🟠 Major（建议修复）

（无）

### 🟡 Minor（可选修复）

（无）

---

## 修复后操作

修复所有 Critical 问题后，重新运行本 skill 扫描。
扫描通过后方可继续生成 plan / 进入开发 / 提交代码。
```

### 步骤 5：阻断决策

| 发现级别 | 处理方式 |
|----------|----------|
| 🔴 Critical | **阻断**：必须修复并重新扫描后才能继续 |
| 🟠 Major | **警告**：建议修复，用户可申请豁免（需说明理由） |
| 🟡 Minor | **提示**：可选修复，不阻断 |

---

## 与现有 Skill 的集成

### plan-generator 集成

plan-generator 生成 plan 后、保存前，自动调用 architecture-guard：

```
plan-generator 生成 plan
    ↓
architecture-guard 扫描 plan.md 中的代码块
    ↓
❌ 发现 Critical → 返回违规列表，plan-generator 修复后重新扫描
✅ 无违规 → plan-generator 保存 plan.md
```

### spec-validator 集成

spec-validator 编写 api-spec.md 后，自动调用 architecture-guard 扫描 DTO 定义：

```
spec-validator 编写 api-spec.md
    ↓
architecture-guard 扫描 spec 中的 DTO 代码块
    ↓
❌ 发现 class-validator → 返回修复建议，spec-validator 修改
✅ 无违规 → 继续用户审批流程
```

### dev-orchestrator 集成

dev-orchestrator 的"架构合规预审"（步骤 5c）直接调用 architecture-guard：

```
dev-orchestrator 步骤 5c
    ↓
architecture-guard 扫描 plan.md + 已存在的相关代码
    ↓
❌ 发现违规 → 暂停编码，列出冲突，等待用户确认
✅ 无违规 → 进入步骤 6 引导开发
```

### kb-review 集成

kb-review 执行代码审查时，将 architecture-guard 作为**自动化预检**：

```
kb-review 开始审查
    ↓
architecture-guard 扫描变更文件
    ↓
输出违规列表（如有）
    ↓
kb-review 将违规纳入审查报告
```

---

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 只扫描生产代码不扫描 plan/spec | plan 中的违规代码示例被复制到实现 | 扫描所有包含代码块的文档 |
| 发现违规但不阻断 | 违规代码继续流入仓库 | Critical 必须修复后才能继续 |
| 忽略 `@BypassResponse` 的合法场景 | 误报 SSE 端点 | 维护豁免清单，SSE 是唯一合法场景 |
| 只扫描当前文件不扫描 import | 通过间接导入引入 class-validator | 扫描 package.json 和 node_modules 依赖树 |

---

## 自检清单

每次扫描完成后自查：

- [ ] 是否扫描了所有目标文件？
- [ ] 是否覆盖了全部 4 个维度？
- [ ] Critical 问题是否都有明确的位置和修复建议？
- [ ] 是否区分了合法豁免场景？
- [ ] 输出格式是否符合分级规范？

---

*本文档与 `docs/guide/backend/architecture-compliance.md` 配套使用。*

# 开发流程

> 核心原则：**契约先行、TDD 强制、分批执行、双轨并行、质量内建。**
>
> 详细规范参见同目录下的 `writing-*.md` 文件。

---

## 阶段速查

| 阶段          | 输入         | 输出                                 | Skill                                 | 规范文档                          |
|---------------|--------------|--------------------------------------|---------------------------------------|-----------------------------------|
| 0. PRD 稳定化 | 需求草案     | 功能批次                             | -                                     | -                                 |
| 1. Issue 拆分 | PRD 批次     | `docs/issues/{prefix}-{NN}-{slug}/`  | `/issue-generator`                    | [Issue 规范](writing-issues.md)   |
| 2. 契约编写   | Issue        | `specs/*.md`                         | `/spec-validator`                     | [Spec 规范](writing-specs.md)     |
| 3. 执行计划   | Issue + Spec | `plan.md` + `plans/v{N}.md`          | `/plan-generator`                     | [Plan 规范](writing-plans.md)     |
| 4. 并行开发   | Plan + Spec  | 代码 + `tests/{layer}/*.spec.ts`    | `/dev-orchestrator`                   | -                                 |
| 5. 联调整合   | 代码         | 审查记录                             | `/kb-review`                          | [Review 规范](writing-reviews.md) |
| 6. 关闭归档   | 已验证代码   | 关闭 issue + 更新 BACKLOG/CHANGELOG  | `/issue-lifecycle` + `/issue-updater` | -                                 |

---

## 文档依赖链

```
prd/ → docs/issues/{dir}/ → 代码 + tests/{layer}/*.spec.ts → reviews/
   ↑___________________________________________|
              （发现 spec 不足时回溯更新）
```

---

## TDD 强制流程（核心变更）

### 规则

1. **测试先行**：每个任务必须以编写失败测试开始
2. **红绿循环**：red（失败）→ green（通过）→ refactor（重构）
3. **测试即文档**：`.spec.ts` 取代 `08-test-cases/` 的 markdown 文档
4. **无测试不合并**：代码审查时，无 `.spec.ts` 视为 Critical 问题

### 测试文件位置

| 类型         | 路径                                 | 指南 |
|--------------|--------------------------------------|------|
| 前端单元测试 | `tests/unit/webui/*.spec.ts`        | [单元测试指南](testing/unit-testing-guide.md) |
| 后端单元测试 | `tests/unit/server/*.spec.ts`       | [单元测试指南](testing/unit-testing-guide.md) |
| 集成测试     | `tests/integration/**/*.spec.ts`     | [集成测试指南](testing/integration-testing-guide.md) |
| E2E 测试     | `tests/e2e/**/*.spec.ts`             | [E2E 测试指南](testing/e2e-testing-guide.md) |

### 开发前检查清单（dev-orchestrator 执行）

- [ ] spec 已编写且包含测试映射表格
- [ ] plan 已生成且每个任务以测试开始
- [ ] `.spec.ts` 测试骨架已创建
- [ ] 运行测试确认失败（red 状态）

---

## 阶段详解

### 阶段 0: PRD 稳定化

**输入**：头脑风暴产物、谈话记录、大 PRD 草案  
**输出**：稳定的 PRD + 功能批次划分

**为什么必须先稳定 PRD**：
- 未经边界定义的 PRD → issue 拆出来还是粗的
- 一次生成太多 spec → spec 质量低，交互状态漏掉
- 中途发现 PRD 不合理 → 已生成的 plan/spec/issue 全作废

**操作**：
1. 从 PRD 中提取确定要做的功能清单
2. 标记优先级（P0/P1/P2）
3. 明确本期不做的东西（防止范围蔓延）
4. **划分批次**：每批 1~3 个相关功能

```markdown
## 功能批次

| 批次 | 功能       | 优先级 | 状态   |
|------|------------|--------|--------|
| 01   | 登录/注册  | P0     | 待启动 |
| 02   | 知识库列表 | P0     | 待启动 |
| 03   | 文件上传   | P1     | 待启动 |
```

**原则**：一批不超过 3 个相关功能，确保 spec-validator 能深入每个交互状态。

---

### 阶段 1: Issue 拆分

**输入**：PRD 中当前批次的功能描述  
**输出**：`docs/issues/{prefix}-{NN}-{slug}/` 目录

**使用 skill**：`/issue-generator`

**轨道前缀**：
- `f-XX`: 前端功能
- `b-XX`: 后端接口
- `d-XX`: 设计
- `i-XX`: 基础设施
- `q-XX`: 质量

**规则**：
- 每个功能拆成 f-XX + b-XX 两个独立 issue
- 极简单功能（纯 UI 无 API）可只拆 f-XX
- 纯后端功能（如数据库迁移）可只拆 b-XX
- 按依赖顺序发布（阻塞者先发布）

详细规范：[writing-issues.md](writing-issues.md)

---

### 阶段 2: 契约编写（Spec）

**输入**：Issue 文件 + PRD 相关章节  
**输出**：`docs/issues/{dir}/specs/*.md`

**使用 skill**：`/spec-validator`

**三层规格**：
1. **功能规格** (`feature-spec.md`)：用户故事、边界、涉及页面
2. **行为规格** (`behavior-spec.md`)：前端交互状态表格（loading/empty/error/success/partial）
3. **API 规格** (`api-spec.md`)：后端接口契约（路由、DTO、错误码）

**测试映射表格**

每个 behavior-spec 和 api-spec 底部必须包含：

```markdown
## 测试映射

| 场景         | 测试文件                              | 测试用例                                              |
|--------------|---------------------------------------|-------------------------------------------------------|
| loading 状态 | `tests/unit/webui/TabBar.spec.ts`    | `AC-01: renders TabBar in AuthenticatedLayout header` |
| 401 错误     | `tests/unit/webui/TabBar.spec.ts`    | `AC-02: displays error on unauthorized`               |
```

**关键规则**：
- 一次只处理一个 issue 的 spec
- 交互状态必须具体到"按钮是否禁用"、"显示什么颜色"
- 发现术语冲突立即解决，不留到编码阶段

详细规范：[writing-specs.md](writing-specs.md)

---

### 阶段 3: 执行计划

**输入**：Issue + Spec  
**输出**：`docs/issues/{dir}/plan.md` + `plans/v{N}.md`

**使用 skill**：`/plan-generator`

**关键规则**：
- 每个步骤 2~5 分钟
- 禁止占位符（"TODO"、"稍后实现"）
- 必须包含具体代码示例和验证命令
- **TDD 强制**：每个任务必须以"编写失败测试"开始，以"运行测试确认通过"结束
- 自检：是否覆盖了 spec 中所有交互状态/端点？

详细规范：[writing-plans.md](writing-plans.md)

---

### 阶段 4: 并行开发

**输入**：Plan + Spec  
**输出**：可运行的代码 + `.spec.ts` 测试

**使用 skill**：`/dev-orchestrator`

**前端 Agent**：
- 读行为规格 → 生成计划 → **先写测试** → 编码 → `/kb-review`
- 若后端 API 未完成，先用 Mock 数据，标记 `TODO: 联调`
- 编码后可用 `/kb-review` 做代码审查与 spec 对齐

**后端 Agent**：
- 读 API 规格 → 生成计划 → **先写测试** → 编码 → `/kb-review`
- 编码后可用 `/kb-review` 做代码审查与安全检查

**TDD 执行检查点**：

每个任务完成后必须输出：
```
[CHECKPOINT] ✅ 测试通过 | 🔍 已验证 | ⏳ 待办 | 🚨 阻塞
```

**测试**：
- 使用 gstack `/tdd` 遵循 red-green-refactor 循环
- 每完成一个任务运行测试，不要攒到最后
- 频繁提交（每个任务一个 commit）

---

### 阶段 5: 联调整合与审查

**输入**：前后端代码  
**输出**：通过端到端测试的完整功能

**使用 skill**：`/kb-review`

**操作**：
1. 前端移除 Mock，对接真实 API
2. 运行端到端测试（Playwright）
3. 使用 `/kb-review` 执行审查：
   - 代码审查：验证代码质量、安全问题
   - 规格对齐审查：验证交互状态是否按 behavior-spec 实现
   - **TDD 合规审查：验证 `.spec.ts` 存在且覆盖所有场景**
   - 安全审查：验证安全基线是否满足
4. 审查记录归档到 `docs/reviews/`

**问题处理**：
- 前端问题 → 回到阶段 4 修复 f-XX
- 后端问题 → 回到阶段 4 修复 b-XX
- spec 问题 → 回到阶段 2 更新 spec（允许回溯）

详细规范：[writing-reviews.md](writing-reviews.md)

---

### 阶段 6: 关闭与归档

**输入**：已验证的代码  
**输出**：关闭的 issue + 更新的进度

**使用 skill**：`/issue-lifecycle` + `/issue-updater`

**操作**：
1. 使用 `/kb-review` 执行关闭前验收：
   - 确认所有 Critical/Major 问题已修复
   - **确认 `.spec.ts` 测试全部通过**
   - 确认类型检查通过
   - 确认审查记录已归档到 `docs/reviews/`
2. 运行 `sync-issue-status.js` 更新 issue 状态
3. 运行 `issue-updater` 更新 `BACKLOG.md` + `CHANGELOG.md`
4. 可选：归档到 `docs/99-archived/issues/`

**然后**：回到阶段 1，启动下一批功能。

---

## 命名规范

全文档命名规范参见：[naming-convention.md](naming-convention.md)

速查：

| 目录            | 命名规则                                               | 示例                                 |
|-----------------|--------------------------------------------------------|--------------------------------------|
| `docs/issues/`  | `{prefix}-{NN}-{kebab-slug}/`                          | `f-15-global-tab-bar/`               |
| `specs/`        | `feature-spec.md` / `behavior-spec.md` / `api-spec.md` | `specs/behavior-spec.md`             |
| `plans/`        | `v{N}.md`                                              | `plans/v1.md`                        |
| `tests/unit/` | `{layer}/{name}.spec.ts`                                  | `webui/TabBar.spec.ts`              |
| `reviews/`      | `{scope}/{type}-v{N}.md`                               | `phase-3/code-v1.md`                 |

---

## 常见陷阱

| 陷阱                    | 后果                       | 正确做法                                                    |
|-------------------------|----------------------------|-------------------------------------------------------------|
| 跳过 spec 直接写 plan   | plan 太粗，交互不符预期    | 必须先写 behavior-spec                                      |
| 一次拆完 PRD 所有 issue | issue 质量低，后期大量返工 | 按批次拆分，做完一批再拆下一批                              |
| 一个 issue 包含前后端   | 无法并行，plan 臃肿        | 拆成 f-XX + b-XX                                            |
| plan 里写 "TODO"        | 工程师不知道怎么做         | 每个步骤给具体代码和命令                                    |
| **不写测试先写实现**    | TDD 流于形式，质量不可控   | **每个任务必须以测试开始**                                  |
| **测试只有 happy path** | 错误场景遗漏，线上崩溃     | **必须覆盖 error/empty/loading 状态**                       |
| 前后端不联调直接关闭    | 接口不匹配                 | 必须联调验证后再关闭                                        |
| 发现 spec 错了硬改代码  | 代码和文档脱节             | 回溯更新 spec，再改代码                                     |
| 审查后不保存记录        | 重复犯同样错误             | 必须归档到 `docs/reviews/`                                  |
| 安全问题不分级          | 阻塞与非阻塞问题混淆       | 使用 `/kb-review` 四级分类                                  |
| 混用验证方案            | 错误格式不一致、全局管道失效 | 统一使用 Zod + nestjs-zod，禁止引入 class-validator         |
| 混淆设计审查与代码审查  | 视觉问题被代码审查遗漏     | 视觉审计用 `/gstack-design-review`，代码审查用 `/kb-review` |

---

## Agent 协作规则

### 输入约束

每个 Agent 启动时只读取：
- 自己的 Issue 文件
- 相关的 Spec 文件
- 必要的代码文件（不遍历整个仓库）

### 输出规范

- 代码变更必须通过测试
- 必须更新相关文档（如 API 变更同步到 Spec）
- 禁止修改不属于自己的文件

### 联调机制

```
前端 Agent 完成 F-15（TabBar 全局化）
    ↓
检查后端 API Spec：B-XX 是否已完成？
    ↓
是 → 直接联调
否 → 使用 Mock 数据，标记 TODO
    ↓
后端 Agent 完成 B-XX
    ↓
验收 Agent 执行联调测试
    ↓
通过 → 关闭两个 Issue
失败 → 分发 Bug 回各自 Agent
```

---

## 验收标准（Phase 级）

每个 Phase 结束时的检查清单：

```markdown
## Phase 1 验收

- [ ] docker-compose up 后所有服务健康
- [ ] Prisma 迁移成功
- [ ] MinIO 可上传/下载文件
- [ ] PostgreSQL pgvector 扩展已启用
- [ ] Redis 可读写

## Phase 2 验收

- [ ] 可注册新用户
- [ ] 可登录/登出
- [ ] 未认证请求返回 401
- [ ] 前端路由守卫正常

## Phase 3 验收

- [ ] 可创建/重命名/删除知识库
- [ ] 可创建/重命名/删除虚拟文件夹
- [ ] 可上传文件到指定文件夹
- [ ] 文件状态正确流转
- [ ] 可删除文档

## Phase 4 验收

- [ ] 可创建会话
- [ ] 可发送消息并接收 SSE 流式回复
- [ ] 可选择多个知识库
- [ ] 可保存/读取设置

## Phase 5 验收

- [ ] 文档可自动解析/分块/向量化
- [ ] pgvector 可执行 ANN 检索
- [ ] RAG 回答包含引用来源
```

---

*详细模板与规范参见 `guide/` 目录下的 `writing-*.md` 文件和 `_templates/` 目录。*

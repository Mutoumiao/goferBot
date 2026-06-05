# 开发流程

> 核心原则：**契约先行、TDD 强制、分批执行、双轨并行、质量内建。**
>
> 详细规范参见同目录下的 `writing-*.md` 文件。

---

## 阶段速查（精简为 3 阶段）

| 阶段 | 输入 | 输出 | Skill | 规范文档 |
|------|------|------|-------|----------|
| 1. 定义 | PRD 批次 | issue + specs + plan | `/issue-generator` + `/spec-validator` + `/plan-generator` | [Issue 规范](writing-issues.md) |
| 2. 实现 | issue + specs + plan | 代码 + 测试 + CHECKPOINT | `/dev-orchestrator` + `/test-scaffold` | [Plan 规范](writing-plans.md) |
| 3. 验收 | 代码 + 测试 | 审查记录 + 关闭 issue | `/kb-review` + `/integration-check` | [Review 规范](writing-reviews.md) |

**精简说明**：
- 原阶段 0（PRD 稳定化）并入阶段 1，作为 issue 拆分的前置输入
- 原阶段 3.5（架构审查）并入阶段 2，作为 plan 保存前的强制检查点
- 原阶段 5（联调整合）与阶段 6（关闭归档）合并为阶段 3，验收即归档
- 阶段减少 → 跳跃步骤更醒目 → 执行偏差更容易被发现

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

| 类型 | 路径 | 指南 |
|------|------|------|
| 前端单元测试 | `tests/unit/webui/*.spec.ts` | [单元测试指南](testing/unit-testing-guide.md) |
| 后端单元测试 | `tests/unit/server/*.spec.ts` | [单元测试指南](testing/unit-testing-guide.md) |
| 集成测试 | `tests/integration/**/*.spec.ts` | [集成测试指南](testing/integration-testing-guide.md) |
| E2E 测试 | `tests/e2e/**/*.spec.ts` | [E2E 测试指南](testing/e2e-testing-guide.md) |

### Agent CHECKPOINT 协议（解决 TDD 执行不到位）

**问题**：口头要求"先写测试"无法验证实际执行顺序。
**方案**：每个编码任务必须输出可验证的 CHECKPOINT，证明 RED → GREEN 的真实发生。

**CHECKPOINT 格式**：

```markdown
[CHECKPOINT] 任务完成验证
- 测试文件：`tests/unit/server/xxx.spec.ts`
- RED 证据：（粘贴测试失败输出，至少包含失败的断言信息）
- 实现文件：`packages/server/src/xxx.ts`
- GREEN 证据：（粘贴测试通过输出，包含 Tests: N passed）
- 对应 spec：AC-XX 描述
- 架构合规：`/architecture-guard` 扫描结果（无 Critical / N 个 Major）
```

**RED 证据要求**：
- 必须包含具体的失败断言（如 `expected 200 to be 401`）
- 必须包含失败的测试用例名称
- 禁止用"测试已失败"等文字描述代替实际输出

**GREEN 证据要求**：
- 必须包含 `Tests: N passed` 或等价输出
- 如果是部分通过，需说明哪些 AC 尚未覆盖

**违规判定**：
- 无 CHECKPOINT → 任务视为未完成
- 有 CHECKPOINT 但无 RED 证据 → 视为"后补测试"，需回退到 RED 阶段重新执行
- RED 和 GREEN 之间无代码变更 → 视为伪造证据

### 开发前检查清单（dev-orchestrator 执行）

- [ ] spec 已编写且包含测试映射表格
- [ ] plan 已生成且每个任务以测试开始
- [ ] `.spec.ts` 测试骨架已创建（通过 `/test-scaffold`）
- [ ] 运行测试确认失败（red 状态）
- [ ] `/architecture-guard` 扫描通过，无 Critical 违规

---

## 阶段详解

### 阶段 1: 定义（原阶段 0+1+2+3.5 合并）

**输入**：PRD 需求 / 用户故事  
**输出**：issue + specs + plan（含架构合规声明）

**为什么合并**：原 4 个阶段（PRD → Issue → Spec → Plan → 架构审查）之间依赖紧密，拆分后容易产生"跳步"和"回溯成本"。合并为单阶段后，所有契约文档一次性产出，减少上下文切换。

**操作**：
1. **PRD 稳定化**：从 PRD 中提取当前批次（1~3 个相关功能），明确本期不做的东西
2. **Issue 拆分**：每个功能拆为 f-XX + b-XX（极简单功能可只拆一端）
3. **契约编写**：为每个 issue 编写三层 spec（feature-spec + behavior-spec + api-spec），底部必须包含测试映射表格
4. **执行计划**：生成 plan.md，头部包含 ADR 合规声明表格，每个任务 2~5 分钟，禁止 TODO
5. **架构审查**：plan 保存前强制调用 `/architecture-guard`，Critical 违规修复后方可进入阶段 2

**阶段 1 完成标准**：
- [ ] issue 目录创建完成
- [ ] 三层 spec 编写完成且包含测试映射
- [ ] plan.md 生成完成，无 TODO，含 ADR 合规声明
- [ ] `/architecture-guard` 扫描通过（无 Critical）

---

### 阶段 2: 实现（原阶段 4，强化 CHECKPOINT）

**输入**：Plan + Spec  
**输出**：可运行的代码 + `.spec.ts` 测试 + 每个任务的 CHECKPOINT

**使用 skill**：`/dev-orchestrator` + `/test-scaffold`

**前端 Agent**：
- 读行为规格 → 生成计划 → **先写测试**（`/test-scaffold`）→ 编码 → `/kb-review`
- 若后端 API 未完成，先用 Mock 数据，标记 `TODO: 联调`
- 编码后可用 `/kb-review` 做代码审查与 spec 对齐

**后端 Agent**：
- 读 API 规格 → 生成计划 → **先写测试**（`/test-scaffold`）→ 编码 → `/kb-review`
- 编码后可用 `/kb-review` 做代码审查与安全检查

**编码中架构合规检查（每个任务）**：

每个任务编码完成后、提交前，调用 `/architecture-guard` 进行快速检查，确保本次变更未引入架构违规。

**规则**：
- 检查通过 → 继续提交
- 检查失败 → **暂停当前任务**，修复违规后方可继续

**新版 CHECKPOINT 协议**（见上方"Agent CHECKPOINT 协议"章节）：
- 必须包含 RED 证据（测试失败输出）
- 必须包含 GREEN 证据（测试通过输出）
- 必须包含对应 spec 的 AC 编号
- 无 CHECKPOINT 的任务视为未完成

**测试**：
- 遵循 red-green-refactor 循环
- 每完成一个任务运行测试，不要攒到最后
- 频繁提交（每个任务一个 commit）

---

### 阶段 3: 验收（原阶段 5+6 合并）

**输入**：前后端代码 + 测试  
**输出**：审查记录 + 关闭的 issue + 更新的 BACKLOG/CHANGELOG

**使用 skill**：`/kb-review` + `/integration-check`

**操作**：
1. 前端移除 Mock，对接真实 API
2. 运行端到端测试（Playwright）
3. 使用 `/kb-review` 执行审查：
   - 代码审查：验证代码质量、安全问题
   - 规格对齐审查：验证交互状态是否按 behavior-spec 实现
   - **TDD 合规审查：验证每个任务的 CHECKPOINT 存在且 RED → GREEN 真实发生**
   - 安全审查：验证安全基线是否满足
4. 使用 `/integration-check` 检查：
   - 前端 API 调用与后端 api-spec 一致性
   - 参数、响应格式、错误码匹配
   - Mock 残留清理
5. 审查记录归档到 `docs/reviews/`
6. 更新 issue 状态、BACKLOG.md、CHANGELOG.md
7. 可选：归档到 `docs/99-archived/issues/`

**问题处理**：
- 前端问题 → 回到阶段 2 修复 f-XX
- 后端问题 → 回到阶段 2 修复 b-XX
- 接口不匹配 → 使用 `/integration-check` 定位差异
- spec 问题 → 回到阶段 1 更新 spec（允许回溯）

**阶段 3 完成标准**：
- [ ] 所有 Critical/Major 问题已修复
- [ ] 每个任务的 CHECKPOINT 已验证（含 RED + GREEN 证据）
- [ ] `.spec.ts` 测试全部通过
- [ ] 类型检查通过
- [ ] 审查记录已归档到 `docs/reviews/`
- [ ] BACKLOG.md + CHANGELOG.md 已更新

---

## 命名规范

全文档命名规范参见：[naming-convention.md](naming-convention.md)

速查：

| 目录 | 命名规则 | 示例 |
|-----------------|--------------------------------------------------------|--------------------------------------|
| `docs/issues/` | `{prefix}-{NN}-{kebab-slug}/` | `f-15-{功能名称}/` |
| `specs/` | `feature-spec.md` / `behavior-spec.md` / `api-spec.md` | `specs/behavior-spec.md` |
| `plans/` | `v{N}.md` | `plans/v1.md` |
| `tests/unit/` | `{layer}/{name}.spec.ts` | `webui/{ComponentName}.spec.ts` |
| `reviews/` | `{scope}/{type}-v{N}.md` | `phase-3/code-v1.md` |

---

## 常见陷阱

| 陷阱 | 后果 | 正确做法 |
|------|------|----------|
| 跳过 spec 直接写 plan | plan 太粗，交互不符预期 | 必须先写 behavior-spec |
| 一次拆完 PRD 所有 issue | issue 质量低，后期大量返工 | 按批次拆分，做完一批再拆下一批 |
| 一个 issue 包含前后端 | 无法并行，plan 臃肿 | 拆成 f-XX + b-XX |
| plan 里写 "TODO" | 工程师不知道怎么做 | 每个步骤给具体代码和命令 |
| **不写测试先写实现** | TDD 流于形式，质量不可控 | **每个任务必须以测试开始** |
| **测试只有 happy path** | 错误场景遗漏，线上崩溃 | **必须覆盖 error/empty/loading 状态** |
| 前后端不联调直接关闭 | 接口不匹配 | 必须联调验证后再关闭 |
| 发现 spec 错了硬改代码 | 代码和文档脱节 | 回溯更新 spec，再改代码 |
| 审查后不保存记录 | 重复犯同样错误 | 必须归档到 `docs/reviews/` |
| 安全问题不分级 | 阻塞与非阻塞问题混淆 | 使用 `/kb-review` 四级分类 |
| 混用验证方案 | 错误格式不一致、全局管道失效 | 统一使用 Zod + nestjs-zod，禁止引入 class-validator |
| 混淆设计审查与代码审查 | 视觉问题被代码审查遗漏 | 视觉审计用 `/gstack-design-review`，代码审查用 `/kb-review` |
| 跳过架构审查直接编码 | 引入 ADR 违规，后期返工 | plan 生成后必须 `/architecture-guard` 扫描 |
| 无 `/integration-check` 直接关闭 | Mock 残留、接口不一致 | 关闭前必须检查前后端契约一致性 |
| **Agent 输出 CHECKPOINT 但无 RED 证据** | 测试是后补的，TDD 流于形式 | **必须粘贴测试失败输出，禁止文字描述代替** |

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
- **每个编码任务必须输出 CHECKPOINT（含 RED + GREEN 证据）**

### 联调机制

```
前端 Agent 完成 F-XX（{前端功能}）
    ↓
检查后端 API Spec：B-XX 是否已完成？
    ↓
是 → 直接联调
否 → 使用 Mock 数据，标记 TODO
    ↓
后端 Agent 完成 B-XX
    ↓
验收 Agent 执行联调测试（/integration-check）
    ↓
通过 → 关闭两个 Issue
失败 → 分发 Bug 回各自 Agent
```

---

## 验收标准（Phase 级）

每个 Phase 结束时的检查清单：

```markdown
## Phase {N} 验收

- [ ] {基础设施/服务} 就绪
- [ ] {核心功能 A} 可验证
- [ ] {核心功能 B} 可验证
- [ ] {安全/性能} 基线达标
```

> 具体验收项根据 Phase 目标定义，参见对应 PRD 章节。

---

*详细模板与规范参见 `guide/` 目录下的 `writing-*.md` 文件和 `_templates/` 目录。*

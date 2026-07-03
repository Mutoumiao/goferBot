# AI Knowledge Architecture

## 架构总览

本项目知识体系按照**知识类型**（Knowledge Type）而非工具划分，分为两层知识和一层运行时约束：

```
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Layers                          │
│                                                              │
│  Business Knowledge (WHAT)                                   │
│  "系统是什么" — 业务规则、API契约、架构、领域模型、验收标准    │
│  权威源: openspec/specs/                                     │
│  加载方式: 通过 Trellis 指南引用，按需加载                     │
│                                                              │
│  Development Knowledge (HOW)                                 │
│  "如何开发" — 编码模式、测试策略、审查清单、常见陷阱、开发入口  │
│  权威源: .trellis/spec/                                      │
│  加载方式: trellis-before-dev 按需加载 index → guidelines     │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    Runtime Layer                             │
│                                                              │
│  Workspace Rules (ALWAYS)                                    │
│  IDE 始终注入的强制约束 — 代码审查、安全规范、提交规范、       │
│  性能模型、Ponytail 模式                                      │
│  权威源: .trae/rules/                                        │
│  加载方式: IDE 自动注入，始终生效，不可绕过                     │
└─────────────────────────────────────────────────────────────┘
```

**容器独立性**：上述分类是知识治理的架构原则。当前使用 OpenSpec 承载 Business Knowledge、Trellis 承载 Development Knowledge，但如果未来替换工具，知识类型划分不变——只是换了容器。

---

## Authority Principle（权威源原则）

每条知识有且仅有一个 **Source of Truth**。所有其他位置只能**引用**（Reference），不得**复制**（Copy）。

| 知识类型 | 唯一权威源 | 冲突时以谁为准 |
|---------|-----------|--------------|
| 业务规则、API 契约、架构定义、领域模型、验收标准、系统流程 | `openspec/specs/` | OpenSpec |
| 编码约定、实现模式、测试策略、审查清单、常见陷阱、开发入口 | `.trellis/spec/` | Trellis |
| 工作区强制规则（审查标准、安全规范、提交规范、Ponytail） | `.trae/rules/` | Rules |

**Golden Rule（知识归属判断法）**：对每条知识问——

> "如果未来实现方式改变（换框架、换架构、换技术栈），这条知识是否仍然有效？"

- **仍然有效** → Business Knowledge → 放入 OpenSpec
- **不再有效** → Development Knowledge → 放入 Trellis
- **始终强制（无论怎么实现都必须遵守）** → Runtime Rules → 放入 `.trae/rules/`

**冲突解决**：发现矛盾时，以权威源为准。例如 Trellis 指南中描述的行为与 OpenSpec 冲突，以 OpenSpec 为准；代码与 Trellis 指南冲突，以指南为准。

---

## Reference > Copy（引用优于复制）

**强制原则**：任何知识不得在多个权威源中重复维护。

- Trellis 指南遇到业务规则 → 链接到 OpenSpec，不得复述
- OpenSpec 遇到实现细节 → 在"证据来源"中引用代码路径或 Trellis 指南，不得描述代码模式
- `.trae/rules/` 遇到项目特有的编码约定 → 引用 Trellis 指南，不得内联编码规范
- CLAUDE.md 是**导航索引**，不是知识仓库。它的职责是告诉 AI "去哪里找"，而不是"内容是什么"

**REFERENCE_ONLY 标头约定**：所有涉及业务的 Trellis 模块指南顶部必须包含：

```markdown
> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为
> [openspec/specs/<capability>/spec.md](relative/path/to/spec.md)（WHAT）。
> <具体哪些内容以 OpenSpec 为准>。
```

这是防止知识泄漏的第一道防线：AI 阅读指南时立刻知道"业务细节不在此文件中"。

**判断法**：如果你发现自己在复制粘贴一段内容到另一个文件——STOP。你应该放一个链接。

---

## 职责边界

| 维度 | Business Knowledge (WHAT) | Development Knowledge (HOW) | Workspace Rules (ALWAYS) |
|------|--------------------------|----------------------------|-------------------------|
| 回答的问题 | 系统是什么？ | 这个项目怎么开发？ | 必须遵守什么？ |
| 内容 | SHALL/MUST 行为定义、API 契约、领域模型、状态机、验收标准 | 具体代码模式、文件路径、测试方法、审查清单、陷阱、入口点 | 全局强制约束、安全规范、审查标准、提交规范 |
| 变更频率 | 业务决策变更时 | 每次任务完成后自然沉淀 | 团队规范调整时（低频） |
| 抽象层级 | 与实现无关 | 与实现绑定 | 与项目无关（跨项目通用模式） |
| 变更流程 | OpenSpec change lifecycle（propose→apply→sync→archive） | trellis-update-spec（即时沉淀） | 手动编辑 rules 文件 |
| 加载方式 | Trellis 指南引用 → 按需跳转 | trellis-before-dev → index → guidelines | IDE 始终注入 |
| 受众 | 产品/架构/开发/AI Agent | 开发者/AI Agent | 所有参与者 |

---

## 目录规范

### Business Knowledge 容器（当前：OpenSpec）

```
openspec/
├── config.yaml              # 项目上下文 + artifact 规则
├── specs/                   # Business Knowledge 权威源
│   ├── auth/spec.md
│   ├── chat/spec.md
│   ├── companion/spec.md
│   ├── admin/spec.md
│   ├── knowledge-base/
│   ├── document/spec.md
│   ├── rag/spec.md
│   ├── queue/spec.md
│   ├── session/spec.md
│   ├── settings/spec.md
│   └── user/spec.md
├── changes/                 # 活跃变更（propose 创建，archive 后移走）
│   └── <change-name>/
│       ├── proposal.md      # 变更动机与范围
│       ├── design.md        # 技术方案
│       ├── tasks.md         # 实施任务清单
│       └── specs/           # Delta specs（ADDED/MODIFIED/REMOVED/RENAMED）
└── README.md                # 本文件
```

### Development Knowledge 容器（当前：Trellis）

```
.trellis/
├── workflow.md              # 开发工作流契约（Plan → Execute → Finish）
├── config.yaml              # Trellis 配置
├── spec/                    # Development Knowledge 权威源
│   ├── <package>/<layer>/
│   │   ├── index.md         # Navigation Hub（导航入口 + Pre-Development Checklist + Quality Gate）
│   │   └── *.md             # 通用指南 + 模块开发指南
│   └── guides/              # 跨包思维方法论
│       ├── index.md
│       └── *.md
├── tasks/                   # 任务目录（活跃 + archive/）
└── workspace/               # 开发者日志
```

### Runtime Rules 容器

```
.trae/rules/
├── ecc/common/code-review.md
├── ecc/common/performance.md
├── ecc/common/security.md
├── ecc/common/testing.md
├── git-commit-message.md
└── ponytail.md
```

### Navigation Hub（项目入口）

[CLAUDE.md](file:///d:/projects/ai-stared-project/knowledge-base/CLAUDE.md) 是项目导航索引。它的职责是**指向**知识，而不是**承载**知识。数据库模型、架构细节、技术栈深度说明应通过链接指向 OpenSpec/Trellis，不得直接内联。

---

## 模块开发指南模板

每个业务模块的 Trellis 开发指南遵循标准 10 章节结构：

1. **Purpose** — 指南目的
2. **Primary OpenSpec** — 权威 OpenSpec capability 链接（REFERENCE_ONLY 标头已声明）
3. **Related OpenSpec** — 相关 OpenSpec capability 链接
4. **Related Trellis Guides** — 相关模块开发指南（跨模块导航）
5. **When You Need To** — 触发条件（什么情况下应该读这篇指南）
6. **Module Dependencies** — 依赖的库/框架
7. **Development Entry** — 代码入口文件路径
8. **Implementation Notes** — 实现要点与模式
9. **Testing Checklist** — 测试验证清单
10. **Common Pitfalls** — 常见陷阱

> 指南顶部必须包含 `REFERENCE_ONLY` 标头。

---

## 知识生命周期与工作流

### 1. 新增业务功能（Additive Change）

业务上新增一个不存在的能力。

```
Grill Me（需求澄清）
  ↓
trellis-brainstorm（Trellis 规划阶段）
  ↓
影响长期业务知识？→ openspec-propose（创建 OpenSpec change）
  ↓                ↓
  │           proposal.md + design.md + tasks.md + specs/(ADDED)
  │                ↓
  │           Review
  │                ↓
  └──────────→ openspec-apply-change（实现）
                    ↓
               trellis-before-dev（加载 Trellis 开发指南）
                    ↓
               开发实现
                    ↓
               trellis-check（质量检查）
                    ↓
               trellis-update-spec（沉淀开发经验到 .trellis/spec/）
                    ↓
               openspec-sync-specs（合并 delta specs 到主 specs）
                    ↓
               openspec-archive-change（归档变更）
```

### 2. Bug 修复（Corrective Change）

修复不符合既有业务规则的行为。

```
trellis-brainstorm（或直接 trellis-before-dev）
  ↓
trellis-before-dev（加载 Trellis 开发指南）
  ↓
开发修复
  ↓
trellis-check（质量检查 + 回归验证）
  ↓
发现业务规则本身有问题（不是实现问题）？→ OpenSpec propose/sync
  ↓
trellis-update-spec（沉淀防坑经验到 .trellis/spec/）
```

**区分关键**：如果代码符合 OpenSpec 但行为不对 → 是 Business Knowledge 问题，走 OpenSpec；如果代码不符合 OpenSpec → 是实现问题，只走 Trellis。

### 3. 架构调整（Implementation Change）

改变 HOW（实现方式），不改变 WHAT（业务行为）。例如：从 REST 迁移到 GraphQL、换 ORM、重构目录结构。

```
Grill Me
  ↓
openspec-explore（探索方案，确认不改变业务行为）
  ↓
openspec-propose（架构变更提案，design.md 重点说明方案选择）
  ↓
openspec-apply-change（实现）
  ↓
trellis-before-dev → 开发 → trellis-check
  ↓
trellis-update-spec（重写/更新受影响的开发指南）
  ↓
openspec-sync-specs → openspec-archive-change
```

**注意**：纯重构（不改变外部行为）如果不影响 API 契约，可以跳过 OpenSpec propose，直接走 Trellis 流程加 trellis-update-spec。

### 4. 业务能力重设计（Business Redesign）

重新定义一个已有的业务能力。不是新增（没有新能力），不是 Bug（没坏），不是架构调整（不只是 HOW 变了，WHAT 本身变了）。例如：重新设计 Auth 模型、重定义 Chat 交互模式、重构 Workspace 概念。

```
Grill Me
  ↓
openspec-explore（深入理解现状 + 探索替代方案 + 兼容性分析）
  ↓
openspec-propose（变更提案）
  ↓                ↓
  │           proposal.md（明确废弃什么、新增什么、迁移路径）
  │           design.md（重点关注数据迁移和向后兼容）
  │           tasks.md（分阶段实施：迁移 → 切换 → 清理）
  │           specs/(MODIFIED + REMOVED + ADDED)
  │                ↓
  │           Review（特别关注：数据迁移、向后兼容、旧指南废弃计划）
  │                ↓
  └──────────→ openspec-apply-change（分阶段实现）
                    ↓
               trellis-before-dev（注意：旧指南可能已失效）
                    ↓
               开发实现（含数据迁移）
                    ↓
               trellis-check
                    ↓
               trellis-update-spec（重写/废弃受影响的模块开发指南）
                    ↓
               openspec-sync-specs（合并 delta specs）
                    ↓
               openspec-archive-change
                    ↓
               清理废弃的 Trellis 指南
```

**关键区别**：Business Redesign 产生 MODIFIED/REMOVED delta specs（而非仅 ADDED），且必须考虑旧 Trellis 指南的废弃/重写。这是风险最高的变更类型。

---

## Progressive Knowledge Loading（渐进式知识加载）

AI Agent **绝对不要预加载全部规范**。知识加载遵循以下导航链：

```
当前 Task
  ↓
trellis-before-dev
  ↓
Navigation Hub: .trellis/spec/<package>/<layer>/index.md
  ↓
  ├─ 按 Pre-Development Checklist 读取通用指南（error-handling、database 等）
  ├─ 按任务类型定位对应模块开发指南
  │    ↓
  │   模块指南（含 REFERENCE_ONLY 标头）
  │    ↓
  │   需要业务规则？→ 点击 Primary OpenSpec 链接
  │    ↓
  │   openspec/specs/<capability>/spec.md（业务知识按需加载）
  │    ↓
  │   涉及跨模块？→ Related OpenSpec → 返回 Navigation Hub 找对应模块指南
  │
  └─ 需要跨包思维？→ guides/index.md
```

**Navigation Hub 的核心职责**：

每个 `index.md` 不是简单的文件列表，而是知识导航中心。它负责：

1. **Pre-Development Checklist**：进入开发前必须阅读的通用指南
2. **Module Guide Index**：按任务类型映射到对应模块指南（"做 X 看 Y"）
3. **OpenSpec Mapping**：每个模块指南对应的 OpenSpec capability
4. **Quality Gate**：完成开发后的质量检查项
5. **跨包导航**：指向 guides/ 和其他 package 的 index.md

**指南的 "When You Need To" 章节**：每个模块指南必须声明触发条件，让 AI 快速判断"这篇指南是否适用于当前任务"。

**跨模块导航**：通过 Related OpenSpec → Navigation Hub → Related Trellis Guides 实现，而不是直接复制其他模块的内容。

---

## 知识沉淀规则

### trellis-update-spec 沉淀规则

`trellis-update-spec` 用于将开发经验沉淀到 `.trellis/spec/`，不是修改业务规则。

**触发时机**：
- 完成一个功能特性后
- 修复一个有价值的 Bug 后（特别是根因分析）
- 发现新的实现模式后
- 踩过一个非显而易见的坑后
- 确立新的团队约定后

**沉淀内容与放置位置**：

| 类型 | 放置位置 |
|------|---------|
| 设计决策（选 X 不选 Y 的原因，仅涉及实现层） | 模块指南 Implementation Notes |
| 项目约定（这个项目怎么做 X） | 通用指南或模块指南 |
| 新的可复用代码模式 | 模块指南 Reusable Patterns |
| 禁止模式/反模式 | 质量指南或模块指南 Common Pitfalls |
| 常见错误/陷阱及根因 | 模块指南 Common Pitfalls |
| 思维触发点/决策框架 | guides/ 下的思维指南 |

**禁止沉淀内容**：业务规则、API 契约定义、状态机定义、领域模型——遇到此类内容应放入 OpenSpec 并在 Trellis 中引用。

### OpenSpec 变更触发

以下情况必须走 OpenSpec change 流程：

- 新的业务能力（ADDED requirement）
- 业务行为改变（MODIFIED requirement）
- 废弃业务能力（REMOVED requirement）
- API 契约变更
- 架构决策影响系统外部行为
- 领域模型变更

---

## Implementation Details（工具实现细节）

以下是当前工具链的具体实现机制。如果未来更换工具容器，本章内容需要更新，但上面的架构原则不变。

### OpenSpec Delta Spec 格式

Delta specs（在 `changes/<name>/specs/` 下）使用以下标记：

```markdown
## ADDED Requirements
### Requirement: 新功能名
系统 SHALL 做某件新事。
#### Scenario: 场景名
- **WHEN** ...
- **THEN** ...

## MODIFIED Requirements
### Requirement: 现有功能名
#### Scenario: 新增/修改的场景
- **WHEN** ...
- **THEN** ...

## REMOVED Requirements
### Requirement: 废弃功能名

## RENAMED Requirements
- FROM: `### Requirement: 旧名称`
- TO: `### Requirement: 新名称`
```

### 交叉引用路径

- **Trellis → OpenSpec**：markdown 相对链接（如 `../../../../openspec/specs/chat/spec.md`），REFERENCE_ONLY 标头声明
- **OpenSpec → Trellis**：`证据来源` 字段引用 Trellis 指南路径或代码文件路径
- **OpenSpec 内部**：markdown 链接跨 capability 引用
- **Trellis 内部**：index.md 表格导航 + Related Trellis Guides
- **JSONL manifests**：`{"file": "<repo-relative-path>", "reason": "<why>"}` 格式，可引用 `.trellis/spec/` 和 `openspec/specs/` 任意文件

### Trellis 子代理上下文清单

`implement.jsonl` 和 `check.jsonl` 通过 repo-root 相对路径加载上下文文件，可以混合引用 Trellis 指南和 OpenSpec specs。

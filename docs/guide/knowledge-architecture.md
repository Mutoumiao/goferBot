# 知识架构总览

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
│  加载方式: Workflow B 通过 before-dev 加载；Workflow A 按需跳转 │
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

## 职责边界

| 维度 | Business Knowledge (WHAT) | Development Knowledge (HOW) | Workspace Rules (ALWAYS) |
|------|--------------------------|----------------------------|-------------------------|
| 回答的问题 | 系统是什么？ | 这个项目怎么开发？ | 必须遵守什么？ |
| 内容 | SHALL/MUST 行为定义、API 契约、领域模型、状态机、验收标准 | 具体代码模式、文件路径、测试方法、审查清单、陷阱、入口点 | 全局强制约束、安全规范、审查标准、提交规范 |
| 变更频率 | 业务决策变更时 | 每次任务完成后自然沉淀 | 团队规范调整时（低频） |
| 抽象层级 | 与实现无关 | 与实现绑定 | 与项目无关（跨项目通用模式） |
| 主导流程 | Workflow A: Grill → Explore → Propose → Apply → Archive | Workflow A: check/update-spec; Workflow B: before-dev → check → update-spec | 手动编辑 rules 文件 |
| 加载方式 | Workflow A: apply-change 自动加载 change artifacts; Workflow B: 从 Trellis 指南链接跳转按需加载 | Workflow B: trellis-before-dev → index → guidelines; Workflow A: 按需跳转 | IDE 始终注入 |
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
└── README.md                # 导航入口
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

[CLAUDE.md](../../CLAUDE.md) 是项目导航索引。它的职责是**指向**知识，而不是**承载**知识。数据库模型、架构细节、技术栈深度说明应通过链接指向 OpenSpec/Trellis，不得直接内联。

---

## 相关文档

- [权威源原则](authority-principle.md) — Authority Principle + Golden Rule + Reference > Copy
- [知识生命周期与工作流](knowledge-workflow.md) — Workflow A (Business Change) + Workflow B (Development Task)
- [渐进式知识加载](progressive-knowledge-loading.md) — AI Agent 如何按需加载知识
- [知识沉淀规则](knowledge-capture-rules.md) — trellis-update-spec + OpenSpec 变更触发条件
- [工具实现细节](implementation-details.md) — Delta Spec 格式、交叉引用路径、模块开发指南模板
- [Spec 更新参考指南](spec-update-reference.md) — Trellis vs OpenSpec 定位 + update-spec 决策流程

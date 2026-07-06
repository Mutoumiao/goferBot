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
│                                                              │
│  Development Knowledge (HOW)                                 │
│  "如何开发" — 编码模式、测试策略、审查清单、常见陷阱、开发入口  │
│  权威源: .trellis/spec/                                      │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                    Runtime Layer                             │
│                                                              │
│  Workspace Rules (ALWAYS)                                    │
│  IDE 始终注入的强制约束                                       │
│  权威源: .trae/rules/                                        │
└─────────────────────────────────────────────────────────────┘
```

**容器独立性**：当前使用 OpenSpec 承载 Business Knowledge、Trellis 承载 Development Knowledge，但如果未来替换工具，知识类型划分不变。

---

## 详细文档导航

本 README 是知识架构的导航入口。详细内容已拆分到 `docs/guide/` 下的独立文档中：

| 文档 | 关注点 |
|------|--------|
| [知识架构总览](../docs/guide/knowledge-architecture.md) | 三层知识架构详解 + 职责边界表 + 目录规范 |
| [权威源原则](../docs/guide/authority-principle.md) | Authority Principle + Golden Rule + Reference > Copy |
| [知识生命周期与工作流](../docs/guide/knowledge-workflow.md) | Workflow A (Business Change) + Workflow B (Development Task) |
| [渐进式知识加载](../docs/guide/progressive-knowledge-loading.md) | AI Agent 如何按需加载知识 |
| [知识沉淀规则](../docs/guide/knowledge-capture-rules.md) | trellis-update-spec + OpenSpec 变更触发条件 |
| [工具实现细节](../docs/guide/implementation-details.md) | Delta Spec 格式、交叉引用路径、模块开发指南模板 |
| [Spec 更新参考指南](../docs/guide/spec-update-reference.md) | Trellis vs OpenSpec 定位 + update-spec 决策流程 |

---

## OpenSpec 目录结构

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
└── README.md                # 本文件（导航入口）
```

---

## 其他入口

- [CLAUDE.md](../CLAUDE.md) — 项目导航索引（技术栈、项目结构、常用命令）
- [.trellis/spec/](../.trellis/spec/) — Development Knowledge 权威源
- [.trae/rules/](../.trae/rules/) — Workspace Rules

# Trellis + OpenSpec Spec 整合方案

## 1. 两个工具的定位与职责

### Trellis (`.trae/`) — 开发执行引擎

Trellis 回答"**怎么做**"的问题，驱动日常开发行为。

| 组成部分 | 路径 | 职责 | 生命周期 |
|----------|------|------|----------|
| **编码规范** | `.trae/rules/` | 代码风格、架构模式、安全要求、测试标准 | 持久化 |
| **特性实施 Spec** | `.trae/specs/{feature}/` | 单个特性的 PRD + 任务清单 + 验证检查清单 | 短暂（特性完成后归档） |
| **Agent 定义** | `.trae/agents/` | trellis-check、trellis-implement、trellis-research | 持久化 |
| **Skill 扩展** | `.trae/skills/` | 各类工作流技能（含 OpenSpec 集成技能） | 持久化 |

### OpenSpec (`openspec/`) — 系统规范引擎

OpenSpec 回答"**做什么**"的问题，维护系统的能力级规范。

| 组成部分 | 路径 | 职责 | 生命周期 |
|----------|------|------|----------|
| **能力规范** | `openspec/specs/{capability}/spec.md` | 系统能力的 SHALL/MUST 级需求定义 + 场景 | 持久化 |
| **变更管理** | `openspec/changes/` | propose → apply → archive 的完整变更生命周期 | 按变更创建/归档 |
| **项目配置** | `openspec/config.yaml` | 项目上下文、artifact 生成规则 | 持久化 |

## 2. 功能边界与互补关系

```
┌───────────────────────────────────────────────────────────┐
│                     Spec 全景架构                          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  OpenSpec (持久化系统规范)           Trellis (开发执行引擎)   │
│  ┌─────────────────────┐          ┌─────────────────────┐ │
│  │ openspec/specs/      │          │ .trae/rules/        │ │
│  │  系统能力需求定义     │◄─引用───│  编码规范与模式      │ │
│  │  • auth/spec.md      │          │  • coding-style.md  │ │
│  │  • chat/spec.md      │          │  • security.md      │ │
│  │  • kb/spec.md        │          │  • testing.md       │ │
│  │  • document/spec.md  │          │  • patterns.md      │ │
│  │  • admin/spec.md     │          └─────────────────────┘ │
│  │  • settings/spec.md  │                                  │
│  └─────────┬───────────┘          ┌─────────────────────┐ │
│            │                      │ .trae/specs/        │ │
│            │      驱动实现         │  特性实施规范        │ │
│            └─────────────────────►│  • spec.md (PRD)     │ │
│                                   │  • tasks.md          │ │
│  openspec/changes/                │  • checklist.md      │ │
│  ┌─────────────────────┐          └─────────────────────┘ │
│  │ 变更管理             │                                  │
│  │  • proposal.md       │◄──引用── .trae/rules/ 编码规范   │
│  │  • design.md         │                                  │
│  │  • delta specs       │──同步──► openspec/specs/        │
│  └─────────────────────┘                                  │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 关键分离原则

| 维度 | Trellis 负责 | OpenSpec 负责 | 禁止 |
|------|-------------|---------------|------|
| **内容类型** | 实现细节、代码模式、任务步骤 | 系统行为、能力需求、验收场景 | — |
| **抽象层级** | Concrete（具体代码/文件/测试） | Abstract（SHALL/MUST 行为定义） | OpenSpec 不写代码模式；Trellis 不写行为定义 |
| **时间维度** | 当前开发周期内 | 跨越多个开发周期 | — |
| **受众** | 开发者（Implementation） | 产品/架构（Specification） | — |
| **变更频率** | 每次开发特性时创建/更新 | 系统行为变更时更新 | 不同步修改同一内容 |

## 3. 工作流协同

### 标准开发流程

```
1. Explore（OpenSpec）
   └─ openspec-explore → 探索想法、分析问题空间
   
2. Propose（OpenSpec）
   └─ openspec-propose → 创建 proposal + design + delta specs
        ↓ 引用 openspec/specs/ 现有能力规范作为基线

3. Plan（Trellis）
   └─ .trae/specs/{feature}/spec.md → PRD + Goals + Non-Goals + FR/NFR
        ↓ 引用 openspec 提案中的 scope 和 design 决策

4. Implement（Trellis）
   └─ trellis-implement → 按 .trae/specs/{feature}/tasks.md 执行
        ↓ 遵循 .trae/rules/ 中的编码规范

5. Check（Trellis）
   └─ trellis-check → 按 .trae/specs/{feature}/checklist.md 验证
        ↓ 同时对照 openspec/specs/ 中的 capability requirements

6. Sync（OpenSpec）
   └─ openspec-sync-specs → 将 delta specs 合并到 openspec/specs/

7. Archive（OpenSpec）
   └─ openspec-archive-change → 归档变更，保留历史
```

### 变更场景对照

| 场景 | 主要工具 | 产物 |
|------|---------|------|
| 全新能力开发 | OpenSpec propose → Trellis implement → OpenSpec sync | openspec/specs/ + .trae/specs/ |
| Bug 修复 | Trellis spec (fix PRD) → Trellis implement | .trae/specs/ |
| 能力行为变更 | OpenSpec propose (delta MODIFIED) → Trellis implement → OpenSpec sync | openspec/specs/ |
| 架构重构 | Trellis rules + Trellis spec (refactor PRD) | .trae/rules/ + .trae/specs/ |

## 4. 目录结构总览

```
knowledge-base/
├── openspec/
│   ├── config.yaml                 # 项目上下文 + artifact 规则
│   ├── specs/                      # 持久化系统能力规范（WHAT）
│   │   ├── auth/spec.md            # 认证与授权
│   │   ├── chat/spec.md            # 聊天与 RAG
│   │   ├── knowledge-base/spec.md  # 知识库管理
│   │   ├── document/spec.md        # 文档处理与索引
│   │   ├── admin/spec.md           # 管理后台
│   │   └── settings/spec.md        # 系统设置
│   └── changes/                    # 活跃变更（propose 创建）
│
├── .trae/
│   ├── rules/                      # 持久化编码规范（HOW）
│   │   ├── ecc/common/             # 通用规范（coding-style, security, testing...）
│   │   ├── architecture.md         # Feature First 架构原则
│   │   └── web-package-rules.md    # packages/web 强制约束
│   ├── specs/                      # 短暂特性实施规范（HOW）
│   │   ├── enterprise-rag/         # PRD + tasks + checklist
│   │   ├── chat-feature/           # PRD + tasks + checklist
│   │   ├── admin-app/              # PRD + tasks + checklist
│   │   └── ...
│   ├── skills/                     # 工作流技能
│   ├── agents/                     # Agent 定义
│   └── commands/                   # 命令定义
```

## 5. 兼容性说明

### OpenSpec 兼容性
- 所有 `openspec/specs/` 下的 spec.md 遵循 OpenSpec 格式要求：
  - `## Purpose` + `## Requirements` 结构
  - `### Requirement:` + `#### Scenario:` 层级
  - `WHEN` / `THEN` 格式场景
  - `SHALL` / `MUST` / `SHOULD` 关键字
- `openspec/config.yaml` 包含完整的 `context` 和 `rules` 配置
- OpenSpec CLI（`openspec list`, `openspec status`, `openspec validate`）可正常解析

### Trellis 兼容性
- `.trae/specs/` 下的 spec.md 保持不变，使用现有的自由格式 PRD
- `.trae/rules/` 中的编码规范继续生效
- Trellis 技能（trellis-check, trellis-implement 等）功能不受影响
- `openspec/specs/` 中引用 `.trae/specs/` 文件路径作为 Evidenced by 来源

### 交叉引用机制
- OpenSpec spec 通过 `Evidenced by` 引用 Trellis spec 和源文件
- Trellis spec 的 Background 可引用 OpenSpec 能力规范作为设计依据
- 两者各自维护独立的内容空间，通过文件路径引用建立关联

## 6. 维护指南

### 何时更新 OpenSpec (`openspec/specs/`)
- 新能力上线且稳定后
- 已有能力的 SHALL/MUST 级行为发生变化
- 新增系统级验收场景

### 何时更新 Trellis Rules (`.trae/rules/`)
- 编码约定发生变化
- 发现新的通用模式或反模式
- 安全策略或测试标准调整

### 何时创建 Trellis Spec (`.trae/specs/`)
- 任何新特性、Bug 修复、重构开始前
- 作为该特性的 PRD + 任务计划 + 检查清单

### 禁止事项
- 不要在 OpenSpec 中写入代码实现细节、文件命名约定、框架用法
- 不要在 Trellis rules 中写入系统行为需求（SHALL/MUST 等）
- 不要在两处同时维护相同或高度相似的内容
- 不要在 Trellis spec 中将 Feature PRD 写成永久的系统能力规范

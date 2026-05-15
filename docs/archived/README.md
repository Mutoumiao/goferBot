# 废弃文档声明 – 请勿使用

以下目录包含项目早期（旧 issues、旧计划文件、旧 ADR 等）的**过时内容**。这些内容已被**弃用**，不再适用于当前开发。

## 已废弃的目录

- `docs/archived/plans/` — 旧功能执行计划（2026-05-06 至 2026-05-14）
- `docs/archived/adr/` — 旧架构决策记录（0001~0006，除 0004 外）
- `docs/archived/issues/` — 旧 Issue 跟踪文件（#01~#13）

## 当前开发必须仅参考以下内容

- 最新的架构规格说明：`docs/superpowers/specs/2026-05-15-cloud-native-rearchitecture.md`
- 最新 ADR：`docs/adr/0004-cloud-native-rearchitecture.md`
- `PROGRESS.md`（项目进度与当前状态）
- `docs/interview-architecture-evolution.md`（架构演进面试指南）

## 对 AI 代理的约束

- 在生成代码、编写测试或回答问题时，**必须忽略**上述废弃目录中的任何文件。
- 若检测到引用来自这些目录的信息，应主动拒绝并提示开发者更新上下文。
- 所有实现必须基于当前的架构 spec 和模块契约编写，不得复制或参考已归档目录中的旧用例。

> 注意：这些废弃文件仅作为历史记录保留，不应被任何自动化流程或人工决策所依赖。

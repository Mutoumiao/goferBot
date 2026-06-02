# 轨道前缀说明（共享引用）

> 本文件被所有流程 skill 共享引用。
> 修改此处 = 全局生效。

---

## 前缀映射

| 前缀 | 轨道 | 职责 | 示例 |
|------|------|------|------|
| `f-XX` | 前端功能 | Vue 组件、页面、交互 | `f-15-global-tab-bar` |
| `b-XX` | 后端接口 | NestJS API、Service、DTO | `b-02-knowledge-base-crud-api` |
| `d-XX` | 设计 | 架构设计、接口契约 | `d-01-rag-sdk-contracts` |
| `i-XX` | 基础设施 | Docker、CI/CD、数据库迁移 | `i-01-docker-compose-infra` |
| `q-XX` | 质量 | 安全基线、E2E 测试、审查 | `q-01-security-baseline` |

## 编号规则

- **全局递增**，不分轨道，从 01 开始
- 已关闭的 issue 编号不复用
- 新 issue 取当前最大编号 + 1

## 目录命名

```
docs/issues/{prefix}-{NN}-{kebab-case-slug}/
```

- `prefix` 必须是 `f` / `b` / `d` / `i` / `q` 之一
- `NN` 两位数字，全局递增
- `slug` 使用 kebab-case，不超过 5 个单词

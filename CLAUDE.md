# GoferBot

GoferBot — 带本地能力的 AI Workspace / Agent OS。基于 Tauri v2 + Vue 3 + Hono 的桌面应用，支持文档管理、LLM 问答、RAG 检索增强。

**架构定位**：云端优先、本地缓存、可扩展 SaaS、AI Native Infrastructure。
**技术栈**：Tauri v2 (Rust) + Vue 3 + Hono + PostgreSQL + MinIO + Milvus + Redis + BullMQ。

用户可导入文档进行管理，通过 LLM 进行问答，支持 RAG 检索增强。

## 项目结构

```
├── packages/
│   ├── webui/                    # Vue 3 前端（@goferbot/webui）
│   ├── server/                   # Node.js Sidecar（@goferbot/server）
│   ├── shellAdapters/            # 平台适配层
│   ├── backendAdapters/          # 后端通信适配层
│   └── rag-sdk/                  # RAG 工具库
├── src-tauri/                    # Tauri Rust 后端
├── tests/                        # 测试（单元/集成/E2E）
├── docs/                         # 文档（新架构 00-meta ~ 08-test-cases）
│   ├── 00-meta/                  # 流程规范、skills
│   ├── 01-prd/                   # 产品需求
│   ├── 02-issues/                # 活跃 issue（双轨前缀 f-/b-/d-/i-/q-）
│   ├── 03-specs/                 # 契约层（Feature/Behavior/API）
│   ├── 04-plans/                 # 执行计划（issue-slug/YYYY-MM-DD.md）
│   ├── 05-adrs/                  # 架构决策记录
│   ├── 06-design/                # 设计系统
│   ├── 07-reviews/               # 审查记录
│   ├── 08-test-cases/            # 测试用例
│   └── 99-archived/              # 历史归档（已废弃）
├── pnpm-workspace.yaml
├── PROGRESS.md                   # 项目进度追踪
└── package.json
```

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + Pinia
- **桌面**：Tauri v2 (Rust)
- **测试**：Vitest + Playwright
- **包管理**：pnpm
- **图标**：lucide-vue-next

## 常用命令

```bash
pnpm dev              # 同时启动前后端
pnpm dev:tauri        # Tauri 开发模式
pnpm test             # 单元测试
pnpm test:e2e         # E2E 测试
pnpm type-check       # TypeScript 类型检查
pnpm -r build         # 构建所有包
```

## 开发规范

### UI 组件
- 使用 [shadcn-vue](https://www.shadcn-vue.com/)，位于 `packages/webui/src/components/ui/`
- 引入：`cd packages/webui && npx shadcn-vue@latest add <component>`
- 颜色使用 Pencil tokens（`bg-surface-1`, `text-text-primary`）
- Class 管理统一使用 `cn()` + `class-variance-authority`

### 编码准则
1. **编码前思考** — 不明确时提问；反对过度复杂的方案
2. **简洁优先** — 最小代码量解决问题；不为不可能的情况加错误处理
3. **精准修改** — 不碰无关代码；只删除你的改动导致的孤立代码
4. **目标驱动** — 将任务转化为可验证目标

## 文档架构

开发前必须阅读对应文档：

| 阶段 | 必读文档 |
|------|----------|
| 了解流程 | `docs/00-meta/workflow.md` |
| 了解产品 | `docs/01-prd/v2-cloud-native.md` |
| 领取任务 | `docs/02-issues/` |
| 编码前 | `docs/03-specs/features/{feature-slug}/` |

## Agent Skills

| Skill | 用途 |
|-------|------|
| `/project-workflow` | 总入口，判断当前阶段 |
| `/issue-generator` | 拆 issue |
| `/spec-validator` | 写 behavior/api spec |
| `/plan-generator` | 生成执行计划 |
| `/dev-orchestrator` | 开发前检查 + 引导编码 |
| `/issue-lifecycle` | 关闭 issue + 同步进度 |

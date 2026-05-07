# 知识库应用（Knowledge-base）

基于 Tauri v2 的本地知识库桌面应用。用户可导入文档（Markdown、TXT 等）进行管理，并保存问答历史记录。应用数据存储在系统用户目录下的 `knowledge-base/` 文件夹中。

## 项目结构

```
├── src/                          # Vue 3 前端源码
│   ├── components/               # Vue 组件
│   ├── stores/                   # Pinia 状态管理（session、settings、knowledgeBase）
│   ├── composables/              # 组合式函数（useSidecar 等）
│   ├── utils/                    # 工具函数（sidecarClient、markdown 等）
│   ├── types/                    # TypeScript 类型定义
│   ├── assets/                   # 静态资源
│   ├── App.vue                   # 根组件
│   └── main.ts                   # 入口文件
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/                      # Rust 源码（lib.rs、sidecar.rs、main.rs）
│   ├── capabilities/             # Tauri v2 能力配置（窗口权限分配）
│   ├── permissions/              # Tauri v2 权限定义（自定义命令 ACL）
│   ├── gen/                      # tauri-build 自动生成文件（schema、类型）
│   ├── Cargo.toml                # Rust 依赖
│   └── tauri.conf.json           # Tauri 配置
├── server/                       # Node.js Sidecar（独立 HTTP 服务）
│   ├── src/                      # Sidecar 源码（Hono 路由、SQLite、LLM 适配器）
│   ├── dist/                     # 编译产物（tsc 输出，Tauri 运行此目录）
│   ├── package.json              # Sidecar 依赖
│   └── tsconfig.json             # Sidecar TypeScript 配置
├── tests/                        # 测试
│   ├── setup/                    # 测试配置（testglobals.ts）
│   └── unit/                     # 单元测试
├── docs/                         # 文档
│   ├── agents/                   # Agent 技能配置（issue-tracker、triage-labels、domain）
│   ├── adr/                      # 架构决策记录（Architecture Decision Records）
│   ├── superpowers/plans/        # 功能执行计划（按日期组织的实现方案）
│   ├── design-discussions/       # 设计讨论记录
│   └── prd-v1.md                 # 产品需求文档
├── .scratch/                     # 临时工作区（不纳入版本控制核心）
│   └── knowledge-base/
│       ├── PRD.md                # 产品需求总纲
│       └── issues/               # Issue 跟踪（01-sidecar-startup ~ 08-test-coverage）
├── public/                       # 公共资源
├── vite.config.ts                # Vite 配置
├── vitest.config.ts              # Vitest 配置
└── package.json                  # 前端依赖
```

## 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **桌面框架**：Tauri v2 (Rust)
- **状态管理**：Pinia
- **CSS 框架**：Tailwind CSS v4
- **测试框架**：Vitest + @vue/test-utils
- **包管理器**：pnpm
- **图标方案**：@egoist/tailwindcss-icons + Material Design Icons

## 本地数据目录

应用数据存储在系统用户目录下的 `knowledge-base/` 中：

- `docs/`：用户导入的文档
- `sidecar.db`：SQLite 数据库
- `.sidecar-port`：Sidecar 监听端口
- `qa-history.json` / `config.json`：历史记录与配置

## 启动命令

- `pnpm dev` —— 启动开发模式（同时运行 Vite dev server 和 Vue Devtools）
- `pnpm build` —— 构建生产版本（TypeScript 类型检查 + Vite 构建）
- `pnpm preview` —— 预览生产构建
- `pnpm type-check` —— 仅运行 TypeScript 类型检查
- `pnpm check` —— 检查 Rust 代码（`cargo check`）
- `pnpm tauri <cmd>` —— 运行 Tauri CLI 命令（如 `pnpm tauri dev`、`pnpm tauri build`）

## 测试验证

- **框架**：Vitest，测试文件 `tests/unit/**/*.test.ts`、`src/**/*.spec.ts`
- **运行**：`pnpm test`

## 注意事项

### Worktree 开发规范

每次 worktree 合并回 `master` 后，在主仓库执行：

```bash
pnpm install
pnpm --dir server install
cd server && npx prebuild-install --download
pnpm test && pnpm type-check && cd server && pnpm build
```

（pnpm v10 默认忽略构建脚本，better-sqlite3 需手动下载原生绑定。）

### Shell 环境偏好

Agent **必须**使用 Bash/POSIX 语法，禁止 PowerShell 特有语法（`$env:VAR`、`Select-Object`、`Where-Object` 等）。例外情况需先说明原因并获许可。

## 编码准则

1. **编码前思考** — 不明确时提问；呈现多种解释；反对过度复杂的方案。
2. **简洁优先** — 最小代码量解决问题；不臆测功能；不为不可能的情况加错误处理。
3. **精准修改** — 不碰无关代码；匹配现有风格；只删除**你的改动**导致的孤立代码。
4. **目标驱动** — 将任务转化为可验证目标（如"修复 bug → 写复现测试并让其通过"）。多步骤任务给出简要计划与验证检查点。

## Agent skills

- **Issue tracker**：`.scratch/` 目录下的 Markdown issue 文件。详见 `docs/agents/issue-tracker.md`。
- **Triage labels**：标准标签词汇，详见 `docs/agents/triage-labels.md`。
- **Domain docs**：单上下文仓库，`CONTEXT.md` 和 `docs/adr/` 位于根目录。详见 `docs/agents/domain.md`。
- **ADR**：`docs/adr/` 目录下的编号决策记录（如 `0001-*.md`）。涉及架构变动前应先查阅。
- **执行计划**：`docs/superpowers/plans/` 目录下按日期组织的实现方案（`YYYY-MM-DD-<feature>.md`）。执行前应先阅读。

# 知识库应用（Knowledge-base）

基于 Tauri v2 的本地知识库桌面应用。用户可导入文档（Markdown、TXT 等）进行管理，并保存问答历史记录。应用数据存储在系统用户目录下的 `knowledge-base/` 文件夹中。

## 项目结构

```
├── src/                    # Vue 3 前端源码
│   ├── components/         # Vue 组件
│   ├── assets/             # 静态资源
│   ├── App.vue             # 根组件
│   ├── main.ts             # 入口文件
│   └── store.ts            # Pinia 状态管理
├── src-tauri/              # Tauri Rust 后端
│   ├── src/                # Rust 源码
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── tests/                  # 测试
│   ├── setup/              # 测试配置
│   └── unit/               # 单元测试
├── docs/                   # 文档
│   └── agents/             # Agent 技能配置
├── public/                 # 公共资源
├── vite.config.ts          # Vite 配置
├── vitest.config.ts        # Vitest 配置
└── package.json            # 前端依赖
```

## 技术栈

- **前端框架**：Vue 3 + TypeScript + Vite
- **桌面框架**：Tauri v2 (Rust)
- **状态管理**：Pinia
- **CSS 框架**：Tailwind CSS v4
- **测试框架**：Vitest + @vue/test-utils
- **包管理器**：pnpm
- **图标方案**：@egoist/tailwindcss-icons + Material Design Icons
- **自动导入**：unplugin-auto-import + unplugin-vue-components

## 项目 UI 要求

- 采用 `tailwindcss` 来管理 CSS 样式

## 本地数据目录

应用启动时通过 `app.getPath('userData')` 获取系统级用户数据目录，并在其下创建 `knowledge-base/` 子目录：

- `knowledge-base/docs/`：用户导入的文档（Markdown、TXT 等）
- `knowledge-base/qa-history.json`：问答历史记录
- `knowledge-base/config.json`：用户配置

主进程负责所有目录初始化与文件 I/O，渲染进程不直接访问文件系统。

## 启动命令

- `pnpm dev` —— 启动开发模式（同时运行 Vite dev server 和 Vue Devtools）
- `pnpm build` —— 构建生产版本（TypeScript 类型检查 + Vite 构建）
- `pnpm preview` —— 预览生产构建
- `pnpm type-check` —— 仅运行 TypeScript 类型检查
- `pnpm check` —— 检查 Rust 代码（`cargo check`）
- `pnpm tauri <cmd>` —— 运行 Tauri CLI 命令（如 `pnpm tauri dev`、`pnpm tauri build`）

## 测试验证

- **测试框架**：Vitest
- **测试文件**：`tests/unit/**/*.test.ts`、`src/**/*.spec.ts`
- **测试配置**：`tests/setup/testglobals.ts`
- **覆盖率提供方**：v8
- **覆盖率阈值**：lines ≥ 10%, branches ≥ 10%, statements ≥ 10%, functions ≥ 0%
- **覆盖率包含范围**：`src/**/*.ts`、`src/**/*.vue`（排除 `src/main.ts`）
- **运行命令**：`pnpm test`

## 注意事项

**权衡**：这些准则偏向谨慎而非速度。对于琐碎任务，请自行判断。

### Worktree 开发规范

本项目使用 Git worktree 进行功能分支隔离开发。Worktree 与原仓库共享 git 历史，但**不共享 `node_modules`**。

每次在 worktree 中完成开发并合并回 `master` 后，必须在**主仓库工作目录**执行以下步骤同步依赖环境：

```bash
# 1. 同步根目录依赖（package.json / pnpm-lock.yaml 可能已变更）
pnpm install

# 2. 同步 sidecar 子项目依赖
pnpm --dir server install

# 3. 确保 better-sqlite3 原生绑定存在
#    （pnpm v10 默认忽略构建脚本，需手动触发预构建下载）
cd server && npx prebuild-install --download

# 4. 运行全量测试验证主仓库状态
pnpm test
pnpm type-check
cd server && pnpm build
```

**为什么必须这样做**：worktree 中安装的新依赖（如 `happy-dom`、`markdown-it`、`better-sqlite3`）只存在于 worktree 的 `node_modules/` 下。`package.json` 和 `pnpm-lock.yaml` 虽然通过 git 同步到了 master，但 master 工作目录的 `node_modules/` 不会自动更新，导致合并后测试/构建直接崩溃。

### pnpm v10 与原生模块

- pnpm v10 默认**忽略所有包的构建脚本**（包括 `better-sqlite3`）。
- `better-sqlite3` 是原生 C++ 模块，安装后需要通过 `prebuild-install` 下载对应平台的 `.node` 二进制文件。
- 若在新环境（如新克隆、CI、新 worktree）中安装 sidecar 依赖后运行报错 `Could not locate the bindings file`，请执行 `cd server && npx prebuild-install --download`。
- 长期可在 `server/.npmrc` 中添加 `ignore-scripts=false` 避免此问题。

## 1. 编码前思考

**不要假设。不要隐藏困惑。明确提出权衡。**

在实施前：

- 明确陈述你的假设。如果不确定，请提问。
- 如果存在多种解释，请呈现出来——不要默默地选择。
- 如果存在更简单的方法，请说出来。必要时提出反对意见。
- 如果不清楚，停下来。指出困惑之处。提问。

## 2. 简洁优先

**解决问题的最小代码量。不要臆测。**

- 不要超出要求的范围添加功能。
- 不要为一次性代码创建抽象。
- 不要添加未被要求的“灵活性”或“可配置性”。
- 不要为不可能发生的情况添加错误处理。
- 如果你写了 200 行而其实 50 行就够了，请重写。

问问自己：“资深工程师会觉得这过于复杂吗？”如果是，请简化。

## 3. 精准修改

**只碰你必须碰的。只清理你自己的烂摊子。**

编辑现有代码时：

- 不要“改进”相邻的代码、注释或格式。
- 不要重构没坏的东西。
- 匹配现有风格，即使你自己会做得不一样。
- 如果你注意到无关的死代码，提一下——但不要删除它。

当你的改动产生孤立代码时：

- 删除**你的改动**导致不再使用的导入/变量/函数。
- 除非被要求，否则不要删除预先存在的死代码。

检验标准：每一行修改都应直接追溯到用户的请求。

## 4. 目标驱动执行

**定义成功标准。循环验证。**

将任务转化为可验证的目标：

- “添加验证” → “为无效输入编写测试，然后让它们通过”
- “修复 bug” → “编写一个能复现它的测试，然后让它通过”
- “重构 X” → “确保重构前后测试都通过”

对于多步骤任务，陈述一个简要计划：

```
1. [步骤] → 验证：[检查]
2. [步骤] → 验证：[检查]
3. [步骤] → 验证：[检查]
```

强有力的成功标准让你能独立迭代。弱标准（“让它工作”）需要不断澄清。

***

**这些准则有效的标志是：** diff 中不必要的变更更少，因过度复杂而导致的重写更少，澄清问题出现在实施前而非犯错后。

## Agent skills

### Issue tracker

问题以本地 Markdown 文件的形式存放在 `.scratch/` 目录下。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的标准标签词汇。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文仓库，`CONTEXT.md` 和 `docs/adr/` 位于仓库根目录。详见 `docs/agents/domain.md`。

# Issue #12: Monorepo 结构迁移

**状态**: 待执行  
**依赖**: #10（Shell Abstraction）、#11（Backend Transport Unification）已完成  
**标签**: `refactor`, `architecture`, `breaking-change`  

---

## 背景

当前项目采用扁平化目录结构，`src/` 中同时存在 Vue UI 代码和 #10/#11 引入的适配层代码（`shell/`、`backend/`），职责混杂。`server/` 虽有独立 `package.json`，但根目录未配置 workspace，导致前后端包管理割裂。

为提升代码组织清晰度、明确依赖边界、支持未来扩展（如 `rag-sdk`），决定将 JS/TS 模块迁移为 Monorepo 结构。

---

## 目标

1. 将前端、适配层、服务层按职责拆分为独立 workspace 包
2. 统一使用 pnpm workspace 管理依赖和脚本
3. 包名统一使用 `@goferbot/` 前缀（产品品牌升级）
4. `src-tauri/` 保留根目录，Rust 构建链零改动
5. 确保迁移后构建、测试、Tauri 运行全部正常

---

## 最终目录结构

```
knowledge-base/
├── packages/
│   ├── webui/                 # Vue 3 前端应用（原 src/）
│   │   ├── src/
│   │   ├── tests/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── vitest.config.ts
│   │   └── package.json       # name: @goferbot/webui
│   ├── shellAdapters/         # 平台适配层（原 src/shell/）
│   │   ├── src/
│   │   ├── package.json       # name: @goferbot/shell-adapters
│   │   └── tsconfig.json
│   ├── backendAdapters/       # 后端通信适配层（原 src/backend/）
│   │   ├── src/
│   │   ├── package.json       # name: @goferbot/backend-adapters
│   │   └── tsconfig.json
│   ├── server/                # Node.js Sidecar（原 server/）
│   │   ├── src/
│   │   ├── dist/
│   │   └── package.json       # name: @goferbot/server
│   └── rag-sdk/               # RAG 工具库（未来扩展，当前为空骨架）
│       ├── src/
│       └── package.json       # name: @goferbot/rag-sdk
├── src-tauri/                 # Tauri v2 Rust 主进程（保留根目录）
│   ├── src/
│   ├── capabilities/
│   └── tauri.conf.json        # 需更新 frontendDist 路径
├── docs/
│   ├── adr/0006-monorepo-migration.md
│   └── ...（其他文档最后统一更新）
├── pnpm-workspace.yaml
├── package.json               # 根 workspace 配置
└── ...
```

---

## 任务清单

### Phase 1: 准备工作

- [ ] 创建 feature branch：`feat/monorepo-migration`
- [ ] 确认 #10、#11 已合并至 `master`
- [ ] 冻结其他大功能合并

### Phase 2: Workspace 配置

- [ ] 创建 `pnpm-workspace.yaml`
- [ ] 更新根 `package.json`
  - [ ] 添加 `"private": true`
  - [ ] 调整 scripts（`dev`、`build`、`test`、`type-check`、`tauri`）
  - [ ] 移除原前端依赖（迁移至 `packages/webui/package.json`）

### Phase 3: 包迁移

#### 3.1 server
- [ ] 移动 `server/` → `packages/server/`
- [ ] 更新 `package.json` 的 `name` 为 `@goferbot/server`
- [ ] 验证 `pnpm --filter @goferbot/server build` 正常

#### 3.2 webui
- [ ] 移动 `src/`、`index.html`、配置文件 → `packages/webui/`
- [ ] 更新 `package.json` 的 `name` 为 `@goferbot/webui`
- [ ] 更新 `vite.config.ts` 路径配置
- [ ] 添加 `workspace:*` 依赖：`@goferbot/shell-adapters`、`@goferbot/backend-adapters`
- [ ] 更新所有内部导入路径（`@/` alias 保持不变）
- [ ] 验证 `pnpm --filter @goferbot/webui dev` 正常

#### 3.3 shellAdapters
- [ ] 创建 `packages/shellAdapters/`
- [ ] 从 `src/shell/` 迁移 #10 代码
- [ ] 创建 `package.json`（`name: @goferbot/shell-adapters`）
- [ ] 创建 `tsconfig.json`
- [ ] 配置构建输出（ESM + 类型声明）
- [ ] 处理 `@tauri-apps/api` 依赖（peerDependencies 或 optionalDependencies）

#### 3.4 backendAdapters
- [ ] 创建 `packages/backendAdapters/`
- [ ] 从 `src/backend/` 迁移 #11 代码
- [ ] 创建 `package.json`（`name: @goferbot/backend-adapters`）
- [ ] 创建 `tsconfig.json`
- [ ] 添加 `@goferbot/shell-adapters` 的 `workspace:*` 依赖
- [ ] 配置构建输出（ESM + 类型声明）

#### 3.5 rag-sdk
- [ ] 创建 `packages/rag-sdk/` 空骨架
- [ ] 创建 `package.json`（`name: @goferbot/rag-sdk`）
- [ ] 添加占位 `README.md`

### Phase 4: Tauri 配置更新

- [ ] 更新 `src-tauri/tauri.conf.json` 中的 `build.frontendDist`
  - 从 `../dist` 改为 `../packages/webui/dist`
- [ ] 验证 `pnpm tauri dev` 正常启动
- [ ] 验证 `pnpm tauri build` 能正确打包

### Phase 5: 测试迁移

- [ ] 将 `tests/unit/` 迁移到 `packages/webui/tests/`
- [ ] 更新各测试文件中的导入路径（mock 路径、模块引用）
- [ ] 更新 `vitest.config.ts` 的 `include` 和 `alias`
- [ ] 确保 Playwright E2E 配置路径正确
- [ ] 运行 `pnpm -r test`，修复所有失败用例

### Phase 6: 验证构建链

- [ ] `pnpm install`（根目录）
- [ ] `pnpm -r build`（全部包构建）
- [ ] `pnpm -r type-check`（全部类型检查）
- [ ] `pnpm -r test`（全部测试通过）
- [ ] `pnpm --filter @goferbot/webui tauri dev`（Tauri 开发模式）
- [ ] `pnpm --filter @goferbot/webui tauri build`（Tauri 生产构建）

### Phase 7: 文档更新

- [ ] 扫描并更新所有涉及目录结构的文档：
  - [ ] `CLAUDE.md`（项目结构、启动命令、技术栈）
  - [ ] `README.md`（项目说明、目录结构）
  - [ ] `ARCHITECTURE.md`（如存在）
  - [ ] `PROGRESS.md`（添加 #12 进度）
  - [ ] `docs/agents/domain.md`（如涉及目录约定）
  - [ ] 其他所有 `.md` 文件（全局搜索 `src/`、`server/` 等旧路径）

---

## 依赖关系

```
#12 (Monorepo Migration)
├── 前置: #10 (Shell Abstraction) — 提供 shellAdapters 代码
├── 前置: #11 (Backend Transport) — 提供 backendAdapters 代码
└── 阻塞: 无
```

---

## 风险

| 风险 | 缓解 |
|------|------|
| 路径引用遗漏 | IDE 全局重构 + `pnpm -r build` 全量检查 |
| Tauri 构建路径错误 | 单独验证 `tauri.conf.json` 和 `tauri build` |
| 测试配置遗漏 | 迁移后立即全量运行测试 |
| 脚本冲突 | 保留根目录常用脚本别名 |

---

## 相关文档

- ADR: `docs/adr/0006-monorepo-migration.md`
- #10: `.scratch/knowledge-base/issues/10-shell-abstraction-and-browser-mode.md`
- #11: `.scratch/knowledge-base/issues/11-backend-transport-unification.md`

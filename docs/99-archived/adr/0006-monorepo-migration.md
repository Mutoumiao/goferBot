# ADR-0006: Monorepo 结构迁移

**状态**: 已接受 (Accepted)  
**日期**: 2026-05-14  
**决策者**: 开发团队  

---

## 1. 背景与问题

当前项目采用扁平化目录结构：

```
knowledge-base/
├── src/                    # Vue 3 前端源码（Web UI）
├── server/                 # Node.js Sidecar（独立 package.json，但非 workspace）
├── src-tauri/              # Tauri v2 Rust 主进程
├── tests/                  # 测试文件
└── package.json            # 前端包配置（单包）
```

随着 #10（Shell Abstraction）和 #11（Backend Transport Unification）的推进，前端 `src/` 中将新增两类**非 UI 模块**：

- `src/shell/` —— 平台适配层（Tauri / Browser / Memory）
- `src/backend/` —— 后端通信适配层（HTTP / Fake）

这些模块的职责是**适配与抽象**，与 Vue 组件、页面、样式等 UI 代码在语义上属于不同层级。继续放在 `src/` 中会导致：

1. **职责混杂**：UI 代码与平台适配代码共存，新成员难以快速理解架构分层
2. **依赖边界模糊**：`shell` 依赖 `@tauri-apps/api`，`backend` 依赖标准 Web API，两者混在同一个 `package.json` 中无法清晰表达依赖关系
3. **扩展困难**：未来计划添加 `rag-sdk` 等独立模块时，缺乏统一的组织规范
4. **server 的孤立**：`server/` 已有独立 `package.json`，但根目录未配置 workspace，导致跨包脚本、依赖管理不统一

---

## 2. 决策目标

1. **语义清晰**：按职责分层组织代码，UI、适配层、服务层各自独立
2. **依赖明确**：每个模块有独立的 `package.json`，精确声明自身依赖
3. **易于扩展**：新模块（如 `rag-sdk`）可按统一规范快速接入
4. **构建统一**：通过 pnpm workspace 统一管理安装、构建、测试流程
5. **最小变动**：`src-tauri/` 保留在根目录，Rust 构建链不受影响

---

## 3. 方案对比

### 方案 A：保持现状（不迁移）

```
src/
  components/     # UI
  stores/         # UI 状态
  composables/    # UI 逻辑
  shell/          # 平台适配（#10 产物）
  backend/        # 通信适配（#11 产物）
  ...
server/           # 独立子目录
```

**优点**：无迁移成本  
**缺点**：
- `src/` 职责混杂，UI 与适配层耦合
- `server/` 与前端包管理割裂
- 未来扩展无规范可循

### 方案 B：完全 Monorepo（所有包纳入 workspace）

```
packages/
  webui/          # Vue 3 前端
  shell/          # 平台适配层
  backend/        # 通信适配层
  server/         # Node.js Sidecar
  rag-sdk/        # 未来扩展
```

**优点**：完全统一  
**缺点**：
- `src-tauri/` 仍在根目录，与 `packages/` 并列，视觉上不一致
- 需要改动 Tauri 构建配置中的相对路径

### 方案 C：部分 Monorepo（推荐）

```
packages/
  webui/              # Vue 3 前端
  shellAdapters/      # 平台适配层
  backendAdapters/    # 通信适配层
  server/             # Node.js Sidecar
  rag-sdk/            # 未来扩展
src-tauri/            # 保留在根目录
```

**优点**：
- JavaScript/TypeScript 模块统一在 `packages/` 下管理
- `src-tauri/` 保留根目录，Rust 构建链零改动
- 语义清晰：`webui` 负责 UI，`adapters` 负责适配，`server` 负责服务
- 包名统一使用 `@goferbot/` 前缀（产品品牌升级）

**缺点**：
- 需要一次性迁移目录和更新路径
- 测试配置需要调整

---

## 4. 详细设计

### 4.1 包结构

| 包名 | 路径 | 职责 | 依赖 |
|------|------|------|------|
| `@goferbot/webui` | `packages/webui/` | Vue 3 前端应用 | `@goferbot/shell-adapters`, `@goferbot/backend-adapters` |
| `@goferbot/shell-adapters` | `packages/shellAdapters/` | 平台抽象（Tauri/Browser/Memory） | `@tauri-apps/api`（peer/optional） |
| `@goferbot/backend-adapters` | `packages/backendAdapters/` | 后端通信抽象（HTTP/Fake） | `@goferbot/shell-adapters` |
| `@goferbot/server` | `packages/server/` | Node.js Sidecar HTTP 服务 | 无内部依赖 |
| `@goferbot/rag-sdk` | `packages/rag-sdk/` | RAG 工具库（未来） | 待定 |

### 4.2 Workspace 配置

**pnpm-workspace.yaml**：

```yaml
packages:
  - 'packages/*'
```

**根 package.json**：

```json
{
  "name": "@goferbot/root",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @goferbot/webui dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "type-check": "pnpm -r type-check",
    "tauri": "pnpm --filter @goferbot/webui tauri"
  }
}
```

### 4.3 路径映射

**`packages/webui/vite.config.ts`**：

```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@goferbot/shell-adapters': path.resolve(__dirname, '../shellAdapters/src'),
    '@goferbot/backend-adapters': path.resolve(__dirname, '../backendAdapters/src'),
  }
}
```

> 注：实际使用 pnpm workspace 时，通过 `workspace:*` 依赖引用，无需手动 alias。

### 4.4 Tauri 配置调整

**`src-tauri/tauri.conf.json`**：

```json
{
  "build": {
    "frontendDist": "../packages/webui/dist"
  }
}
```

### 4.5 测试配置调整

**`packages/webui/vitest.config.ts`**：

```typescript
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.spec.ts'],
  },
})
```

各包的测试独立运行，根目录通过 `pnpm -r test` 聚合。

---

## 5. 迁移步骤

### 阶段一：准备工作

1. 确保 #10（Shell Abstraction）和 #11（Backend Transport）已完成并合并到 `master`
2. 创建 feature branch：`git checkout -b feat/monorepo-migration`
3. 冻结其他大功能合并，避免冲突

### 阶段二：创建 Workspace 骨架

1. 创建 `pnpm-workspace.yaml`
2. 更新根 `package.json`（添加 `private: true`，调整 scripts）
3. 创建 `packages/` 目录

### 阶段三：迁移各包

1. **server** → `packages/server/`
   - 移动全部文件
   - 更新 `package.json` 的 `name` 为 `@goferbot/server`
   - 验证 `pnpm --filter @goferbot/server build` 正常

2. **webui** → `packages/webui/`
   - 移动 `src/`、`index.html`、配置文件
   - 更新 `package.json` 的 `name` 为 `@goferbot/webui`
   - 更新 `vite.config.ts` 中的路径
   - 验证 `pnpm --filter @goferbot/webui dev` 正常

3. **shellAdapters** → `packages/shellAdapters/`
   - 从 `src/shell/` 迁移 #10 代码
   - 创建独立 `package.json`、`tsconfig.json`
   - 配置构建输出（ESM + 类型声明）

4. **backendAdapters** → `packages/backendAdapters/`
   - 从 `src/backend/` 迁移 #11 代码
   - 创建独立 `package.json`、`tsconfig.json`
   - 添加对 `@goferbot/shell-adapters` 的 `workspace:*` 依赖

5. **rag-sdk** → `packages/rag-sdk/`
   - 创建空骨架（或占位 `README.md`）

### 阶段四：更新 Tauri 配置

1. 更新 `src-tauri/tauri.conf.json` 中的 `frontendDist`
2. 验证 `pnpm tauri dev` 正常启动
3. 验证 `pnpm tauri build` 能正确打包

### 阶段五：测试迁移

1. 将 `tests/unit/` 迁移到 `packages/webui/tests/`
2. 更新各测试文件中的导入路径
3. 更新 `vitest.config.ts` 的 `include` 和 `alias`
4. 运行 `pnpm -r test`，确保全部通过

### 阶段六：验证与文档

1. 完整验证：
   ```bash
   pnpm install
   pnpm -r build
   pnpm -r test
   pnpm --filter @goferbot/webui tauri dev
   ```
2. 更新全局文档（`CLAUDE.md`、`README.md`、`ARCHITECTURE.md` 等）
3. 合并到 `master`

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 迁移过程中路径引用遗漏 | 高 | 使用 IDE 全局重构 + `pnpm -r build` 全量编译检查 |
| Tauri 构建产物路径错误 | 高 | 单独验证 `tauri.conf.json` 和 `tauri build` |
| 测试配置遗漏导致 CI 失败 | 中 | 迁移后立即全量运行测试，修复所有路径问题 |
| pnpm workspace 与现有脚本冲突 | 中 | 保留根目录常用脚本的别名（`dev`、`build`、`test`） |
| 团队成员适应新结构 | 低 | 更新 `CLAUDE.md` 和 `README.md`，添加目录结构说明 |

---

## 7. 结论

采用**方案 C：部分 Monorepo 迁移**：

- JavaScript/TypeScript 模块统一迁移到 `packages/` 目录
- 按职责分为 `webui`、`shellAdapters`、`backendAdapters`、`server`、`rag-sdk`
- 包名统一使用 `@goferbot/` 前缀
- `src-tauri/` 保留根目录，Rust 构建链零改动
- 通过 pnpm workspace 统一管理依赖和脚本

此方案在**语义清晰度**、**扩展性**和**迁移成本**之间取得平衡，为后续产品品牌升级（GoferBot）和模块扩展奠定基础。

# Issue #13: shadcn-vue UI 体系重构

**状态**: closed  
**依赖**: #12（Monorepo 结构迁移）已完成  
**标签**: `refactor`, `ui`, `frontend`, `shadcn-vue`  

---

## 背景

当前 `packages/webui/src/components/` 中有 24 个完全自定义的 Vue 组件，所有基础 primitive（Button、Input、Dialog 等）均为手写的 raw HTML + Tailwind。这导致：

1. **样式不一致**：按钮圆角从 `rounded-md` 到 `rounded-[28px]` 有 10+ 种变体
2. **代码重复**：没有统一的 Button、Input 组件，每个文件都写 raw `<button>`
3. **可访问性缺失**：零 `aria-*` 属性，零 focus ring，键盘导航不完整
4. **无 variant 系统**：样式通过条件 class 数组硬编码，无法统一管理

引入 shadcn-vue 作为基础 UI 底座，在保留现有 Pencil 设计系统的前提下，解决上述问题。

---

## 目标

1. **引入 shadcn-vue** 作为基础 UI 组件库，提供稳定、可访问的 primitive
2. **统一 class 管理**：全项目使用 `cn()` + `class-variance-authority`（CVA）
3. **保留双轨制**：shadcn 组件使用标准 CSS 变量（`--background`、`--primary` 等），业务组件继续使用 Pencil tokens（`bg-surface-1`、`text-text-primary` 等）
4. **分批替换**：按优先级逐步替换现有组件中的 raw HTML primitive
5. **减少 E2E 负担**：shadcn-vue 自带交互测试，降低自定义 UI 的测试成本

---

## 关键决策记录

### 1. 定制深度原则

| 层级   | 说明                       | 使用场景           |
|--------|----------------------------|--------------------|
| 层级 1 | 仅改样式（Tailwind class） | 改颜色、圆角、阴影 |
| 层级 2 | 改结构 + 样式              | 加插槽、调整布局   |
| 层级 3 | 完全重写                   | 复杂业务交互       |

**原则**：shadcn-vue 组件最多定制到层级 2。复杂业务交互（如 Mention 下拉、文件拖拽）自行开发业务组件，不魔改 shadcn 源码。

### 2. CSS 变量双轨制

**shadcn 接口层**（`components/ui/` 使用）：
```css
:root {
  --background: 228 20% 97.6%;        /* surface-1 */
  --foreground: 220 18% 14%;          /* text-primary */
  --primary: 228 94% 67%;             /* accent-500 */
  --secondary: 220 14% 95.3%;         /* surface-2 */
  --destructive: 5 42% 50%;           /* danger-500 */
  --border: 220 14% 91.8%;            /* border-default */
  --ring: 228 94% 67%;                /* accent-500 */
  --radius: 0.625rem;
}
```

**Pencil 实现层**（业务组件继续使用）：
```css
@theme {
  --color-surface-1: #f7f8fa;
  --color-text-primary: #1f2328;
  --color-accent-500: #5b7cfa;
  /* ... 保留所有现有 tokens */
}
```

### 3. Dark Mode 预留

当前仅实现浅色主题，但 `:root` 和 `.dark` 变量均已定义，未来只需填充 `.dark` 的值并添加切换逻辑。

---

## 分批引入计划

### 第一批：核心 primitive（P0）

解决最基础的样式不一致问题。

| 组件                   | 替换目标                                 | 现有文件影响                                                      |
|------------------------|------------------------------------------|-------------------------------------------------------------------|
| `Button`               | 所有 raw `<button>`                      | 全部 24 个组件                                                    |
| `Input`                | 所有 raw `<input>`                       | `ChatInput.vue`, `SettingsPage.vue`, `InlineRename.vue` 等        |
| `Textarea`             | `ChatInput.vue` 的 textarea              | `ChatInput.vue`                                                   |
| `Dialog`               | `EditKbDialog.vue`, `MoveCopyDialog.vue` | `EditKbDialog.vue`, `MoveCopyDialog.vue`, `KnowledgeBasePage.vue` |
| `AlertDialog`          | `ConfirmDialog.vue`（确认/警告场景）     | `ConfirmDialog.vue`                                               |
| `Label`                | 所有表单标签                             | `SettingsPage.vue`, `EditKbDialog.vue`                            |
| `FieldGroup` + `Field` | 所有表单布局                             | `SettingsPage.vue`, `EditKbDialog.vue`, `MoveCopyDialog.vue`      |

### 第二批：交互组件（P1）

解决可访问性和复杂交互。

| 组件           | 替换目标                                       | 现有文件影响                           |
|----------------|------------------------------------------------|----------------------------------------|
| `DropdownMenu` | `ContextMenu.vue`（部分）、`ModelSelector.vue` | `ContextMenu.vue`, `ModelSelector.vue` |
| `Select`       | `SettingsPage.vue` 的 native select            | `SettingsPage.vue`                     |
| `Tabs`         | `SettingsPage.vue`、`TabBar.vue`               | `SettingsPage.vue`, `TabBar.vue`       |
| `Switch`       | `SettingsPage.vue` 的自定义 toggle             | `SettingsPage.vue`                     |
| `Separator`    | 各种分隔线                                     | `SideBar.vue`, `SettingsPage.vue`      |

### 第三批：展示组件（P2）

提升视觉一致性和用户体验。

| 组件       | 替换目标                         | 现有文件影响                                                 |
|------------|----------------------------------|--------------------------------------------------------------|
| `Badge`    | 状态标签                         | `RecycleBinPage.vue`, `FileExplorer.vue`                     |
| `Card`     | 卡片布局                         | `KnowledgeBasePage.vue`, `EmptySession.vue`                  |
| `Skeleton` | Loading 状态                     | `ChatLoading.vue`, `FileExplorer.vue`                        |
| `Tooltip`  | 替代 native `title`              | 全局                                                         |
| `Avatar`   | `ChatMessage.vue`, `SideBar.vue` | `ChatMessage.vue`, `SideBar.vue`                             |
| `Empty`    | 空状态                           | `EmptySession.vue`, `FileExplorer.vue`, `RecycleBinPage.vue` |

### 暂不引入（自行封装业务组件）

| 功能         | 原因                                                        | 方案                                   |
|--------------|-------------------------------------------------------------|----------------------------------------|
| `Combobox`   | `KbMentionDropdown.vue`、`ModelSelector.vue` 有复杂过滤逻辑 | 基于 `DropdownMenu` + `Input` 自行封装 |
| `Table`      | `FileExplorer.vue` 用 CSS grid，需求特殊                    | 保持现有实现                           |
| `Toast`      | `ChatPage.vue` toast 有特定定位逻辑                         | 保持现有实现或基于 `Dialog` 封装       |
| `Pagination` | `HistoryPage.vue` 的分页有自定义样式                        | 保持现有实现                           |
| `Command`    | 命令面板，当前无此需求                                      | 暂不引入                               |
| `Popover`    | 与 `DropdownMenu` 功能重叠                                  | 按需评估                               |

---

## 业务组件重构清单

### 需要拆分为 "primitive + 业务封装" 的组件

| 现有组件             | 拆分方案                                                                                            |
|----------------------|-----------------------------------------------------------------------------------------------------|
| `ConfirmDialog.vue`  | `ui/AlertDialog.vue`（primitive）+ `components/ConfirmDialog.vue`（业务封装：图标、标题、按钮逻辑） |
| `EditKbDialog.vue`   | `ui/Dialog.vue` + `components/EditKbDialog.vue`（表单逻辑，使用 FieldGroup + Field）                |
| `MoveCopyDialog.vue` | `ui/Dialog.vue` + `components/MoveCopyDialog.vue`（文件夹树逻辑，使用 FieldGroup + Field）          |
| `ContextMenu.vue`    | `ui/DropdownMenu.vue` + `components/ContextMenu.vue`（右键定位逻辑）                                |

### 需要重构 class 管理的组件（全部）

所有 24 个组件中的条件 class 数组替换为 `cn()` + CVA：

```typescript
// 重构前
:class="[
  'flex items-center justify-center',
  props.size === 'sm' ? 'h-8 px-3' : 'h-10 px-4',
  props.variant === 'primary' ? 'bg-accent-500' : 'bg-surface-2',
]"

// 重构后
const buttonVariants = cva('flex items-center justify-center', {
  variants: {
    size: { sm: 'h-8 px-3', default: 'h-10 px-4' },
    variant: { primary: 'bg-accent-500', secondary: 'bg-surface-2' }
  }
})

:class="cn(buttonVariants({ size, variant }), $attrs.class)"
```

---

## 技术栈变更

### 新增依赖

```json
{
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "radix-vue": "^1.9.0",
    "lucide-vue-next": "^0.400.0"
  }
}
```

### 新增文件

```
packages/webui/src/
  components/
    ui/                    # shadcn-vue 组件（通过 CLI 生成）
      button/
      input/
      textarea/
      dialog/
      alert-dialog/
      label/
      field-group/
      field/
      dropdown-menu/
      select/
      tabs/
      switch/
      separator/
      badge/
      card/
      skeleton/
      tooltip/
      avatar/
      empty/
    # 业务组件保持原位，逐步重构
  lib/
    utils.ts               # cn() 工具函数
  assets/
    main.css               # 更新：添加 shadcn CSS 变量
```

---

## 任务清单

### Phase 1: 初始化 shadcn-vue

- [ ] 在 `packages/webui/` 中执行 `npx shadcn-vue@latest init`
- [ ] 配置 `components.json`（确认路径、别名、Tailwind 配置）
- [ ] 安装底层依赖：`tailwind-merge`, `clsx`, `class-variance-authority`, `radix-vue`
- [ ] 创建 `src/lib/utils.ts`（`cn()` 函数）
- [ ] 更新 `src/assets/main.css`：添加 shadcn CSS 变量（`:root` 和 `.dark` 预留）
- [ ] 验证初始化：运行 `pnpm dev`，确认无报错

### Phase 2: 第一批核心 primitive（P0）

- [ ] `npx shadcn-vue add button`
  - [ ] 定制样式：映射到 Pencil 颜色（`bg-accent-500` 等）
  - [ ] 验证：在测试页中使用 `<Button>`，确认样式正确
- [ ] `npx shadcn-vue add input`
  - [ ] 定制样式：focus ring 颜色、`border-default`
- [ ] `npx shadcn-vue add textarea`
  - [ ] 定制样式：与 Input 一致
- [ ] `npx shadcn-vue add dialog`
  - [ ] 定制样式：圆角、阴影、动画
- [ ] `npx shadcn-vue add alert-dialog`
  - [ ] 定制样式：与 Dialog 一致，用于确认/警告场景
- [ ] `npx shadcn-vue add label`
  - [ ] 定制样式：字体大小、颜色
- [ ] `npx shadcn-vue add field-group` + `field`
  - [ ] 表单布局基础组件
- [ ] 重构业务组件使用 P0 primitive
  - [ ] `ConfirmDialog.vue` → 拆分为 `ui/AlertDialog` + 业务封装
  - [ ] `EditKbDialog.vue` → `ui/Dialog` + FieldGroup/Field 表单布局
  - [ ] `MoveCopyDialog.vue` → `ui/Dialog` + FieldGroup/Field 表单布局
  - [ ] 全局替换 raw `<button>` → `<Button>`（图标使用 data-icon）
  - [ ] 全局替换 raw `<input>` → `<Input>`
  - [ ] `ChatInput.vue` → `<Textarea>`
  - [ ] 全局表单布局 → `FieldGroup` + `Field`

### Phase 3: 第二批交互组件（P1）

- [ ] `npx shadcn-vue add dropdown-menu`
- [ ] `npx shadcn-vue add select`
- [ ] `npx shadcn-vue add tabs`
- [ ] `npx shadcn-vue add switch`
- [ ] `npx shadcn-vue add separator`
- [ ] 重构业务组件
  - [ ] `ContextMenu.vue` → 基于 `DropdownMenu` 封装
  - [ ] `ModelSelector.vue` → 基于 `DropdownMenu` 或 `Select`
  - [ ] `SettingsPage.vue` → `<Select>`, `<Tabs>`, `<Switch>`, `<Label>`
  - [ ] `TabBar.vue` → `<Tabs>`

### Phase 4: 第三批展示组件（P2）

- [ ] `npx shadcn-vue add badge`
- [ ] `npx shadcn-vue add card`
- [ ] `npx shadcn-vue add skeleton`
- [ ] `npx shadcn-vue add tooltip`
- [ ] `npx shadcn-vue add avatar`
- [ ] 重构业务组件
  - [ ] `KnowledgeBasePage.vue` → `<Card>`
  - [ ] `EmptySession.vue` → `<Card>` + `<Empty>`
  - [ ] `ChatLoading.vue` → `<Skeleton>`
  - [ ] `ChatMessage.vue` → `<Avatar>`
  - [ ] 全局替换 `title` → `<Tooltip>`
  - [ ] `FileExplorer.vue` / `RecycleBinPage.vue` → `<Empty>`

### Phase 5: class 管理统一化

- [ ] 安装 `class-variance-authority`
- [ ] 为所有业务组件创建 CVA variants（如有必要）
- [ ] 替换所有条件 class 数组为 `cn()` + CVA
- [ ] 验证：全局搜索 `:class="[` 确认无遗漏

### Phase 6: 可访问性验证

- [ ] 检查所有交互组件的键盘导航
- [ ] 检查 focus ring 显示
- [ ] 检查 ARIA 属性（shadcn 自带，验证是否正确渲染）
- [ ] 运行屏幕阅读器测试（NVDA/VoiceOver）

### Phase 7: 全面测试

- [ ] `pnpm type-check` —— 无类型错误
- [ ] `pnpm test` —— 单元测试全部通过
- [ ] `pnpm test:e2e` —— E2E 测试全部通过
- [ ] `pnpm build` —— 构建成功
- [ ] `pnpm tauri dev` —— Tauri 应用正常启动
- [ ] 视觉回归测试：关键页面截图对比

### Phase 8: 文档更新

- [ ] 更新 `CLAUDE.md`：添加 shadcn-vue 说明、组件使用规范
- [ ] 更新 `packages/webui/README.md`（如存在）：添加 UI 开发指南
- [ ] 更新 `PROGRESS.md`：标记 #13 完成
- [ ] 创建 `packages/webui/src/components/ui/README.md`：说明 shadcn 组件定制规则

---

## 风险与缓解

| 风险                             | 影响 | 缓解                                                             |
|----------------------------------|------|------------------------------------------------------------------|
| shadcn-vue 与 Tailwind v4 兼容性 | 高   | 确认 shadcn-vue 支持 Tailwind v4；如遇问题，参考官方迁移指南     |
| 样式覆盖冲突                     | 中   | 严格区分 `ui/`（shadcn 变量）和业务组件（Pencil tokens）；不混用 |
| 组件体积增加                     | 低   | shadcn-vue 按需引入，Tree-shaking 友好；监控构建产物大小         |
| 团队学习成本                     | 低   | shadcn-vue API 简洁；文档化定制规则                              |
| 现有自定义动画丢失               | 中   | 保留自定义 CSS 动画；shadcn 动画通过 CSS 变量调整                |

---

## 验收标准

- [ ] 所有 raw `<button>` 替换为 `<Button>`
- [ ] 所有 raw `<input>` 替换为 `<Input>`
- [ ] 所有确认/警告 Dialog 使用 `ui/AlertDialog`，其他使用 `ui/Dialog`
- [ ] 所有表单使用 `FieldGroup` + `Field` 布局
- [ ] 所有 Button 图标使用 `data-icon`，不加 sizing class
- [ ] 无 `:class="[` 条件数组（全部使用 `cn()` + CVA）
- [ ] 键盘导航完整（Tab、Enter、Escape、Arrow keys）
- [ ] Focus ring 在所有交互元素上可见
- [ ] 构建产物大小增加 < 20%
- [ ] 所有测试通过
- [ ] 视觉无回归（关键页面截图对比通过）

---

## 相关文档

- shadcn-vue 官方文档：https://www.shadcn-vue.com/
- Radix Vue 文档：https://www.radix-vue.com/
- Tailwind CSS v4 文档：https://tailwindcss.com/docs/v4-beta
- #12 Issue: `.scratch/knowledge-base/issues/12-monorepo-migration.md`
- ADR-0006: `docs/adr/0006-monorepo-migration.md`

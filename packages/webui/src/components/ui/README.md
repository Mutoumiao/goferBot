# UI 组件库说明

本目录下的组件均来自 [shadcn-vue](https://www.shadcn-vue.com/)，基于 Radix Vue 与 Tailwind CSS 构建。

## 使用规范

### 1. 优先使用现成组件

在实现业务功能前，先检查 `src/components/ui/` 中是否已有对应组件。常见组件映射：

| 需求 | 使用组件 |
|------|----------|
| 按钮 | `Button` |
| 输入框 | `Input` |
| 对话框 | `Dialog` / `AlertDialog` |
| 确认弹窗 | `AlertDialog`（不可点击遮罩关闭） |
| 下拉菜单 | `DropdownMenu` |
| 选择器 | `Select` |
| 标签页 | `Tabs` |
| 开关 | `Switch` |
| 卡片 | `Card` |
| 徽标 | `Badge` |
| 加载占位 | `Skeleton` |
| 提示 | `Tooltip` |
| 头像 | `Avatar` |
| 分隔线 | `Separator` |
| 表单布局 | `FieldGroup` + `Field` |

### 2. 样式定制原则

- **不修改组件内部样式**：通过传入 `class` 进行外观调整
- **使用项目设计 token**：优先使用 `bg-surface-1`、`text-text-primary` 等 Pencil 设计系统变量，而非 shadcn 默认的 `bg-background`、`text-foreground`
- **保持交互一致性**：按钮 hover、focus 状态遵循 shadcn 默认行为，颜色映射到项目 token

### 3. 图标规范

- 统一使用 `lucide-vue-next` 图标库
- 按钮内图标添加 `data-icon="inline-start"` 属性
- 不在图标上加 `size-*` 类，由组件或父级控制尺寸

### 4. 表单规范

- 使用 `FieldGroup` + `Field` 包裹表单元素，不使用裸 `div`
- 验证状态：`data-invalid` 放在 `Field` 上，`aria-invalid` 放在控件上
- 选项组（2-7 个选项）使用 `ToggleGroup`，不要手动循环 `Button`

### 5. 对话框规范

- 普通弹窗使用 `Dialog`，必须包含 `DialogTitle`
- 确认/警告弹窗使用 `AlertDialog`，不可点击遮罩关闭
- 不需要手动设置 `z-index`，组件已处理层叠

## 添加新组件

如需新增 shadcn-vue 组件：

```bash
cd packages/webui
npx shadcn-vue@latest add <component-name>
```

添加后检查：
1. 导入路径是否正确（使用 `@/components/ui/...`）
2. 图标库是否匹配项目（应为 `lucide-vue-next`）
3. 样式是否符合项目设计系统

## 组件列表

当前已安装组件：

- `alert-dialog` - 确认对话框
- `button` - 按钮
- `dialog` - 对话框
- `dropdown-menu` - 下拉菜单
- `field` - 表单字段（含 FieldGroup、FieldLabel 等）
- `form` - 表单验证
- `input` - 输入框
- `label` - 标签
- `select` - 选择器
- `separator` - 分隔线
- `switch` - 开关
- `tabs` - 标签页
- `textarea` - 文本域
- `badge` - 徽标
- `card` - 卡片
- `skeleton` - 骨架屏
- `tooltip` - 文字提示
- `avatar` - 头像

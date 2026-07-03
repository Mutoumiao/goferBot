# 组件指南

> 本项目中组件的构建方式。

---

## 概述

Admin 前端使用 **Ant Design 6.x** 作为主要 UI 组件库，配合 **Pro Components** 实现企业级管理后台布局。样式使用 **Tailwind CSS v4**。组件分为三层：通用组件、布局组件、功能模块组件。

---

## 组件结构

### 文件结构

```tsx
interface ComponentProps {
  // 定义所有 props
}

export function ComponentName({ prop1, prop2, ...rest }: ComponentProps) {
  // 使用 use* hooks 获取状态或上下文
  // 处理业务逻辑
  // 返回 JSX
}
```

### 示例：通用组件

```tsx
interface EmptyStateProps {
  description?: string
  actionText?: string
  onAction?: () => void
}

export function EmptyState({ description, actionText, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <Inbox size={32} className="text-gray-400" />
      </div>
      <p className="mt-4 text-sm text-gray-500">{description}</p>
      {actionText && onAction && (
        <Button type="primary" size="small" className="mt-4" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  )
}
```

### 示例：表格组件

```tsx
import { Button, Table, Space, Tag, Switch, Popconfirm } from 'antd'

interface UserTableProps {
  data: AdminUserResponse[]
  loading?: boolean
  onToggleStatus?: (id: string, isActive: boolean) => void
  onDelete?: (id: string) => void
}

export function UserTable({ data, loading, onToggleStatus, onDelete }: UserTableProps) {
  const columns = [
    {
      title: '用户',
      dataIndex: 'email',
      key: 'email',
      render: (_: unknown, record) => (
        <div className="flex items-center gap-3">
          <Avatar size="small">
            {(record.name ?? record.email)[0].toUpperCase()}
          </Avatar>
          <div>
            <div className="text-sm font-medium">{record.name ?? '未命名'}</div>
            <div className="text-xs text-gray-500">{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) =>
        role === 'ADMIN' ? <Tag color="purple">管理员</Tag> : <Tag>普通用户</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record) => (
        <Space size="small">
          <Switch
            checked={record.isActive}
            onChange={() => onToggleStatus?.(record.id, record.isActive)}
          />
          <Popconfirm
            title="确定删除？"
            onConfirm={() => onDelete?.(record.id)}
          >
            <Button type="text" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Table
      rowKey="id"
      loading={loading}
      dataSource={data}
      columns={columns}
      pagination={{ showSizeChanger: true, showQuickJumper: true }}
    />
  )
}
```

---

## Props 约定

### 基础规则

1. **接口定义**：始终为组件定义 Props 接口，不使用 `PropsWithChildren`
2. **可选 props**：非必需 props 使用 `?` 标记
3. **类型导出**：如果 props 需要在其他地方引用，导出类型
4. **默认值**：在函数参数中提供默认值，而非在组件内部

### Props 命名

| 类型 | 命名规则 | 示例 |
|------|----------|------|
| 布尔开关 | `isXxx`, `hasXxx` | `isLoading`, `hasPermission` |
| 回调函数 | `onXxx`, `handleXxx` | `onClick`, `onSubmit` |
| 数据列表 | 复数形式 | `items`, `users` |
| 单个数据 | 单数形式 | `item`, `user` |

---

## 样式模式

### Ant Design + Tailwind CSS v4

Admin 前端同时使用 Ant Design 和 Tailwind CSS v4：

- **Ant Design**：用于复杂 UI 组件（Table、Form、Modal、Select 等）
- **Tailwind CSS v4**：用于自定义布局、间距、颜色等

### 样式优先级

1. 优先使用 Ant Design 组件的 `style` 和 `className` 属性
2. 使用 Tailwind 类名进行精细调整
3. 避免内联 `style={{}}`，仅在必要时使用

### 主题配置

通过 `ConfigProvider.tsx` 统一配置 Ant Design 主题：

```tsx
import { ConfigProvider } from 'antd'
import { theme } from 'antd'

export function ConfigProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 8,
        },
      }}
    >
      {children}
    </ConfigProvider>
  )
}
```

---

## 无障碍

### 基本要求

1. **语义化标签**：使用 `button`、`a`、`input` 等语义化标签
2. **ARIA 属性**：为自定义组件添加适当的 ARIA 属性
3. **键盘导航**：确保所有交互元素可通过键盘访问
4. **颜色对比度**：使用 Ant Design 默认主题，确保良好的颜色对比度

### 表单无障碍

```tsx
import { Form, Input, Button } from 'antd'

export function LoginForm() {
  return (
    <Form layout="vertical">
      <Form.Item
        label="邮箱"
        name="email"
        rules={[{ required: true, message: '请输入邮箱' }]}
      >
        <Input placeholder="请输入邮箱" />
      </Form.Item>
      <Form.Item
        label="密码"
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password placeholder="请输入密码" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" block>登录</Button>
      </Form.Item>
    </Form>
  )
}
```

---

## 常见错误

| 错误模式 | 正确做法 |
|----------|----------|
| 直接修改 Ant Design 组件源码 | 创建 wrapper 组件或使用 `style`/`className` |
| 在组件内部直接调用 API | 通过 services.ts 封装，使用 `useQueryWithRetry` |
| 忽略 loading 状态 | 始终处理 loading 状态，使用 Ant Design 的 `loading` 属性 |
| 未处理错误状态 | 使用 `try-catch` + `toast` 或 `Alert` 组件展示错误 |
| 使用 `any` 类型 | 使用明确的类型或 `unknown` |
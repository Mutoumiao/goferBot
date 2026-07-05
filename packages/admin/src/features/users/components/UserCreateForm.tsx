import type { FormInstance } from 'antd'
import { Checkbox, Form, Input, Modal, Spin } from 'antd'
import type { Role } from '@/features/roles/services'
import { fetchRoles } from '@/features/roles/services'
import type { AdminRoleCode } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import { createUserService } from '../services'

interface FormValues {
  email: string
  name?: string
  password: string
  roles: AdminRoleCode[]
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  user: '普通用户',
}

function isCurrentUserSuperAdmin(): boolean {
  const state = useAuthStore.getState()
  return !!state.user?.roles?.includes('super_admin')
}

function filterAssignableRoles(roles: Role[]): Role[] {
  const isSuperAdmin = isCurrentUserSuperAdmin()
  if (isSuperAdmin) {
    return roles.filter((r) => r.app === 'admin')
  }
  return roles.filter((r) => r.app === 'admin' && r.code !== 'super_admin' && r.code !== 'admin')
}

async function loadAssignableRoles(): Promise<Role[]> {
  const list = await fetchRoles()
  return filterAssignableRoles(list)
}

export async function createUserModal(): Promise<boolean> {
  let roles: Role[] = []
  try {
    roles = await loadAssignableRoles()
  } catch {
    roles = []
  }

  return new Promise((resolve) => {
    const formRef: { current: FormInstance<FormValues> | null } = { current: null }
    const [form] = Form.useForm<FormValues>()

    const options = roles.map((r) => ({
      label: `${ROLE_LABELS[r.code] ?? r.name}（${r.code}）`,
      value: r.code as AdminRoleCode,
    }))

    const modal = Modal.confirm({
      title: '新建用户',
      width: 480,
      content: (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="pt-2"
          initialValues={{ roles: [] }}
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item name="name" label="昵称">
            <Input placeholder="选填" />
          </Form.Item>

          <Form.Item
            name="password"
            label="初始密码"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password placeholder="至少 8 位" />
          </Form.Item>

          <Form.Item
            name="roles"
            label="角色（可多选）"
            rules={[{ required: true, message: '请选择至少一个角色' }]}
            extra={
              isCurrentUserSuperAdmin()
                ? '勾选 admin 或 super_admin 即为管理员账号'
                : '当前账号仅能创建普通用户'
            }
          >
            {options.length === 0 ? (
              <Spin size="small" />
            ) : (
              <Checkbox.Group options={options} className="flex flex-col gap-2" />
            )}
          </Form.Item>
        </Form>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        try {
          const values = await form.validateFields()
          const res = await createUserService(values)
          if (res.success) {
            resolve(true)
            modal.destroy()
          } else {
            return Promise.reject(new Error(res.error))
          }
        } catch {
          return Promise.reject(new Error('validation failed'))
        }
      },
      onCancel: () => {
        resolve(false)
        modal.destroy()
      },
    })

    void formRef
  })
}

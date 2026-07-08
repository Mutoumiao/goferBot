import { Form, Input, Modal, Select } from 'antd'
import type { AdminRoleCode } from '@/stores/auth'
import type { AdminUserResponse } from '../services'
import { updateUserService } from '../services'

const ROLE_OPTIONS: { value: AdminRoleCode; label: string }[] = [
  { value: 'user', label: '普通用户' },
  { value: 'admin', label: '管理员' },
  { value: 'super_admin', label: '超级管理员' },
]

interface FormValues {
  name?: string
  roles: AdminRoleCode[]
}

export function editUserModal(user: AdminUserResponse): Promise<boolean> {
  return new Promise((resolve) => {
    const [form] = Form.useForm<FormValues>()

    const modal = Modal.confirm({
      title: '编辑用户',
      width: 480,
      content: (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="pt-2"
          initialValues={{
            name: user.name,
            roles: user.roles ?? [],
          }}
        >
          <Form.Item label="邮箱">
            <Input disabled value={user.email} />
          </Form.Item>
          <Form.Item name="name" label="昵称">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="roles" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select mode="multiple" options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      ),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        try {
          const values = await form.validateFields()
          const res = await updateUserService(user.id, {
            name: values.name,
            roles: values.roles,
            updatedAt: user.updatedAt,
          })
          if (res.success) {
            resolve(true)
            modal.destroy()
          } else if (res.conflict) {
            resolve(false)
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
  })
}

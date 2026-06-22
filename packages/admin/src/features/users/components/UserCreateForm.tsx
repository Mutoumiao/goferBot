import { Form, Input, Modal, Select } from 'antd'
import type { FormInstance } from 'antd'
import { createUserService } from '../services'

interface FormValues {
  email: string
  name?: string
  password: string
  role: 'ADMIN' | 'USER'
}

export function createUserModal(): Promise<boolean> {
  return new Promise((resolve) => {
    const [form] = Form.useForm<FormValues>()

    const modal = Modal.confirm({
      title: '新建用户',
      width: 480,
      content: (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="pt-2"
          initialValues={{ role: 'USER' }}
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
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              options={[
                { value: 'USER', label: '普通用户' },
                { value: 'ADMIN', label: '管理员' },
              ]}
            />
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
    void (null as unknown as FormInstance<FormValues> | null)
  })
}

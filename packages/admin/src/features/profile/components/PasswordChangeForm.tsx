import { App, Button, Card, Form, Input } from 'antd'
import { changePasswordService } from '@/features/profile/services'

interface PasswordFormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export function PasswordChangeForm() {
  const { message } = App.useApp()
  const [form] = Form.useForm<PasswordFormValues>()

  const handleChangePassword = async () => {
    try {
      const values = await form.validateFields()
      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的新密码不一致')
        return
      }
      if (values.oldPassword === values.newPassword) {
        message.error('新密码不能与旧密码相同')
        return
      }
      const res = await changePasswordService(values.oldPassword, values.newPassword)
      if (res.success) {
        form.resetFields()
      }
    } catch {
      // handled
    }
  }

  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        className="max-w-md"
        initialValues={{ oldPassword: '', newPassword: '', confirmPassword: '' }}
      >
        <Form.Item
          name="oldPassword"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
        >
          <Input.Password placeholder="请输入当前密码" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 位' },
          ]}
        >
          <Input.Password placeholder="至少 8 位" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          rules={[{ required: true, message: '请再次输入新密码' }]}
        >
          <Input.Password placeholder="再次输入新密码" />
        </Form.Item>
        <Button type="primary" onClick={() => void handleChangePassword()}>
          保存修改
        </Button>
      </Form>
    </Card>
  )
}

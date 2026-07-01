import { useState } from 'react'
import { Card, Form, Input, Button, Typography, message } from 'antd'
import { useRouter } from '@tanstack/react-router'
import { changePassword, changePasswordForce } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const { Title, Text } = Typography

export function PasswordChangeForm() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const setMustChangePassword = useAuthStore((s) => s.setMustChangePassword)
  const mustChangePassword = useAuthStore((s) => s.user?.mustChangePassword)

  const onFinish = async (values: {
    currentPassword?: string
    newPassword: string
    confirmPassword: string
  }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }

    setLoading(true)
    try {
      if (mustChangePassword) {
        await changePasswordForce({ newPassword: values.newPassword }).send()
      } else {
        await changePassword({
          currentPassword: values.currentPassword!,
          newPassword: values.newPassword,
        }).send()
      }

      setMustChangePassword(false)
      message.success('密码修改成功，正在刷新页面...')
      await router.invalidate()
      void router.navigate({ to: '/dashboard', replace: true })
    } catch (err) {
      const errorMsg = (err as { message?: string })?.message || '密码修改失败，请重试'
      message.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div style={{ maxWidth: 480, width: '100%' }}>
        <Card>
          <Title level={4} style={{ textAlign: 'center', marginBottom: 8 }}>
            {mustChangePassword ? '首次登录：请修改初始密码' : '修改密码'}
          </Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
            {mustChangePassword ? '为了您的账户安全，请设置一个新的强密码' : '请输入新密码以完成修改'}
          </Text>
          <Form
            name="changePassword"
            layout="vertical"
            onFinish={onFinish}
            autoComplete="off"
            requiredMark={false}
          >
            {!mustChangePassword && (
              <Form.Item
                label="当前密码"
                name="currentPassword"
                rules={[{ required: true, message: '请输入当前密码' }]}
              >
                <Input.Password placeholder="请输入当前密码" />
              </Form.Item>
            )}

            <Form.Item
              label="新密码"
              name="newPassword"
              rules={[
                { required: true, message: '请输入新密码' },
                {
                  min: 8,
                  message: '密码至少 8 位',
                },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
                  message: '密码必须包含大小写字母和数字',
                },
              ]}
            >
              <Input.Password placeholder="至少 8 位，包含大小写字母和数字" />
            </Form.Item>

            <Form.Item
              label="确认新密码"
              name="confirmPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '请再次输入新密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'))
                  },
                }),
              ]}
            >
              <Input.Password placeholder="再次输入新密码" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                确认修改
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  )
}
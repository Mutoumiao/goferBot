import { Card, Descriptions, Form, Input, Button, Tabs, App, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { PageHeader } from '@/components/common/PageHeader'
import { changePasswordService } from '@/features/auth/services'

interface PasswordFormValues {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const { message } = App.useApp()
  const [form] = Form.useForm<PasswordFormValues>()
  const [history, setHistory] = useState<Array<{ id: string; ip: string; device: string; time: string }>>([])

  useEffect(() => {
    setHistory([
      { id: '1', ip: '192.168.1.100', device: 'Chrome / Windows', time: new Date(Date.now() - 3600000).toLocaleString('zh-CN') },
      { id: '2', ip: '192.168.1.100', device: 'Chrome / Windows', time: new Date(Date.now() - 86400000).toLocaleString('zh-CN') },
      { id: '3', ip: '10.0.0.5', device: 'Safari / macOS', time: new Date(Date.now() - 172800000).toLocaleString('zh-CN') },
    ])
  }, [])

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
    <div className="space-y-4">
      <PageHeader title="个人中心" description="查看个人信息、修改密码、查看登录历史" />

      <Tabs
        items={[
          {
            key: 'info',
            label: '基本信息',
            children: (
              <Card>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="ID">{user?.id}</Descriptions.Item>
                  <Descriptions.Item label="邮箱">{user?.email}</Descriptions.Item>
                  <Descriptions.Item label="昵称">{user?.name ?? '—'}</Descriptions.Item>
                  <Descriptions.Item label="角色">
                    <Tag color="purple">{user?.role ?? '—'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={user?.isActive ? 'green' : 'default'}>
                      {user?.isActive ? '已启用' : '已禁用'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
          {
            key: 'password',
            label: '修改密码',
            children: (
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
            ),
          },
          {
            key: 'history',
            label: '登录历史',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  dataSource={history}
                  pagination={false}
                  columns={[
                    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
                    { title: '设备', dataIndex: 'device', key: 'device' },
                    { title: '时间', dataIndex: 'time', key: 'time', width: 200 },
                  ]}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

import { Modal, Form, Input } from 'antd'
import { createModel } from '@/api/model'

interface FormValues {
  provider: string
  model: string
  endpoint: string
  apiKey: string
}

export function ModelConfigForm(): Promise<boolean> {
  return new Promise((resolve) => {
    const [form] = Form.useForm<FormValues>()
    const modal = Modal.confirm({
      title: '新建模型',
      width: 480,
      content: (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="pt-2"
          initialValues={{ provider: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1' }}
        >
          <Form.Item name="provider" label="Provider" rules={[{ required: true, message: '请输入 Provider' }]}>
            <Input placeholder="例如：DeepSeek" />
          </Form.Item>
          <Form.Item name="model" label="Model" rules={[{ required: true, message: '请输入 Model' }]}>
            <Input placeholder="例如：deepseek-chat" />
          </Form.Item>
          <Form.Item
            name="endpoint"
            label="Endpoint URL"
            rules={[
              { required: true, message: '请输入 Endpoint' },
              {
                validator: (_, value) => {
                  if (!value || /^https?:\/\//.test(value)) return Promise.resolve()
                  return Promise.reject(new Error('Endpoint 必须以 http:// 或 https:// 开头'))
                },
              },
            ]}
          >
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="sk-..." />
          </Form.Item>
        </Form>
      ),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        try {
          const values = await form.validateFields()
          await createModel(values)
          resolve(true)
          modal.destroy()
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

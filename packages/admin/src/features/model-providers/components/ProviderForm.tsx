import { Form, Input, InputNumber, Modal, Select, Switch } from 'antd'
import type { ModelProvider, ProviderType } from '@/api/system-config'
import { saveProviderService } from '../services'

interface FormValues {
  id: string
  name: string
  type: ProviderType
  model: string
  apiKey: string
  baseUrl: string
  timeoutMs: number
  enabled: boolean
  dimensions?: number
  maxLength?: number
}

interface ProviderFormProps {
  open: boolean
  provider?: ModelProvider
  onCancel: () => void
  onSuccess: () => void
}

export function ProviderForm({ open, provider, onCancel, onSuccess }: ProviderFormProps) {
  const [form] = Form.useForm<FormValues>()
  const isEdit = !!provider

  return (
    <Modal
      title={isEdit ? '编辑 Provider' : '新建 Provider'}
      open={open}
      width={560}
      okText="保存"
      cancelText="取消"
      onCancel={onCancel}
      destroyOnHidden
      onOk={async () => {
        try {
          const values = await form.validateFields()
          const ok = await saveProviderService(values as ModelProvider)
          if (ok) {
            onSuccess()
          }
        } catch {
          // 校验失败时保持 Modal 打开
        }
      }}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        className="pt-2"
        initialValues={
          provider
            ? { ...provider }
            : {
                type: 'llm' as ProviderType,
                enabled: true,
                timeoutMs: 30000,
              }
        }
      >
        <Form.Item name="id" label="ID" rules={[{ required: true, message: '请输入 ID' }]}>
          <Input disabled={isEdit} placeholder="唯一标识，如 deepseek" />
        </Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
          <Input placeholder="显示名称" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
          <Select
            disabled={isEdit}
            options={[
              { value: 'llm', label: 'LLM' },
              { value: 'embedding', label: 'Embedding' },
              { value: 'reranker', label: 'Reranker' },
              { value: 'document-parser', label: 'Document Parser' },
            ]}
          />
        </Form.Item>
        <Form.Item name="model" label="模型" rules={[{ required: true, message: '请输入模型' }]}>
          <Input placeholder="如 deepseek-chat" />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label="API Key"
          rules={[{ required: true, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Form.Item
          name="baseUrl"
          label="Base URL"
          rules={[
            { required: true, message: '请输入 Base URL' },
            {
              validator: (_, value) => {
                if (!value || /^https?:\/\//.test(value)) return Promise.resolve()
                return Promise.reject(new Error('必须以 http:// 或 https:// 开头'))
              },
            },
          ]}
        >
          <Input placeholder="https://api.example.com/v1" />
        </Form.Item>
        <Form.Item
          name="timeoutMs"
          label="超时 (ms)"
          rules={[{ required: true, message: '请输入超时时间' }]}
        >
          <InputNumber min={1000} step={1000} className="w-full" />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(prev, next) => prev.type !== next.type}>
          {({ getFieldValue }) => {
            const type = getFieldValue('type') as ProviderType
            if (type === 'embedding') {
              return (
                <Form.Item name="dimensions" label="Dimensions">
                  <InputNumber min={1} className="w-full" placeholder="如 1536" />
                </Form.Item>
              )
            }
            if (type === 'reranker') {
              return (
                <Form.Item name="maxLength" label="Max Length">
                  <InputNumber min={1} className="w-full" placeholder="如 512" />
                </Form.Item>
              )
            }
            return null
          }}
        </Form.Item>
        <Form.Item name="enabled" valuePropName="checked">
          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

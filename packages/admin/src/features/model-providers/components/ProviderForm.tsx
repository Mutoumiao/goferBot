import { App, Col, Form, Input, InputNumber, Modal, Row, Select, Switch } from 'antd'
import { useEffect, useState } from 'react'
import type { Model, ModelProvider, ProviderPreset, ProviderType } from '@/api/system-config'
import { fetchPresets, fetchRemoteModelsService, saveProviderService } from '../services'
import { mapErrorMessage } from '@/utils/error-mapper'
import { ProviderModelsTable } from './ProviderModelsTable'

interface FormValues {
  id?: string
  name: string
  notes?: string
  apiKey: string
  baseUrl: string
  isCompleteUrl: boolean
  timeoutMs: number
  enabled: boolean
}

interface ProviderFormProps {
  open: boolean
  provider?: ModelProvider
  onCancel: () => void
  onSuccess: () => void
}

const CUSTOM_PRESET = 'custom'

const DEFAULT_VALUES: FormValues = {
  name: '',
  apiKey: '',
  baseUrl: '',
  isCompleteUrl: false,
  timeoutMs: 300_000,
  enabled: true,
}

export function ProviderForm({ open, provider, onCancel, onSuccess }: ProviderFormProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<FormValues>()
  const isEdit = !!provider
  const [presets, setPresets] = useState<ProviderPreset[]>([])
  const [presetKey, setPresetKey] = useState<string>(CUSTOM_PRESET)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  /** 模型列表独立受控，不走 Form.List，避免 Modal 下不同步 */
  const [models, setModels] = useState<Model[]>([])
  const baseUrl = Form.useWatch('baseUrl', form) as string | undefined

  useEffect(() => {
    if (!open) return
    void fetchPresets().then(setPresets)
  }, [open])

  const initFormValues = () => {
    form.resetFields()
    if (provider) {
      const { models: providerModels, ...rest } = provider
      form.setFieldsValue({ ...rest })
      setModels(providerModels ?? [])
      setPresetKey(CUSTOM_PRESET)
    } else {
      form.setFieldsValue({ ...DEFAULT_VALUES })
      setModels([])
      setPresetKey(CUSTOM_PRESET)
    }
  }

  const handlePresetChange = (key: string) => {
    setPresetKey(key)
    if (key === CUSTOM_PRESET) return
    const preset = presets.find((p) => p.key === key)
    if (preset) {
      form.setFieldsValue({ name: preset.name, baseUrl: preset.baseUrl })
    }
  }

  const handleFetchModels = async (): Promise<void> => {
    const currentBaseUrl = form.getFieldValue('baseUrl')
    const apiKey = form.getFieldValue('apiKey') ?? ''
    if (!currentBaseUrl) {
      message.warning('请先填写请求地址')
      return
    }
    if (presetKey === CUSTOM_PRESET) {
      message.warning('自定义供应商不支持自动获取模型')
      return
    }
    setFetching(true)
    try {
      const remoteModels = await fetchRemoteModelsService({
        presetKey,
        baseUrl: currentBaseUrl,
        apiKey,
      })
      if (remoteModels.length === 0) {
        message.warning('未获取到模型')
        return
      }

      const existingNames = new Set(models.map((m) => m.name))
      const newModels = remoteModels
        .filter((m) => !existingNames.has(m.name))
        .map<Model>((m) => ({
          name: m.name,
          type: m.type as ProviderType,
          enabled: true,
          ...(m.dimensions !== undefined && { dimensions: m.dimensions }),
          ...(m.maxLength !== undefined && { maxLength: m.maxLength }),
        }))
      setModels((prev) => [...prev, ...newModels])
      message.success(`获取到 ${newModels.length} 个新模型`)
    } catch (err) {
      message.error(mapErrorMessage(err))
    } finally {
      setFetching(false)
    }
  }

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      if (models.length === 0) {
        message.warning('请至少添加一个模型')
        return
      }
      if (models.some((m) => !m.name.trim())) {
        message.warning('模型名不能为空')
        return
      }
      setSaving(true)
      const payload: ModelProvider = {
        // R2: 新建时 id 留空，由后端 saveProvider 自动生成；编辑时保留原 id
        id: provider?.id ?? '',
        name: values.name,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        isCompleteUrl: values.isCompleteUrl ?? false,
        timeoutMs: values.timeoutMs,
        // enabled 不在表单控件中编辑，沿用原值；新建默认 true
        enabled: provider?.enabled ?? true,
        models,
        ...(values.notes ? { notes: values.notes } : {}),
      }
      const ok = await saveProviderService(payload)
      if (ok) onSuccess()
    } catch {
      // 校验失败时保持 Modal 打开
    } finally {
      setSaving(false)
    }
  }

  const presetOptions = [...presets.map((p) => ({ value: p.key, label: p.label }))]

  return (
    <Modal
      title={isEdit ? '编辑提供商' : '新建提供商'}
      open={open}
      width={720}
      okText="保存"
      cancelText="取消"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={handleOk}
      mask={{ closable: false }}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (visible) initFormValues()
      }}
    >
      <Form form={form} layout="vertical" className="pt-2" initialValues={DEFAULT_VALUES}>
        <Form.Item label="预设提供商">
          <Select value={presetKey} onChange={handlePresetChange} options={presetOptions} />
        </Form.Item>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="供应商名称"
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder="如 DeepSeek" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="notes" label="备注">
              <Input placeholder="可选备注" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="apiKey"
          label="API Key"
          rules={[{ required: true, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="sk-..." />
        </Form.Item>
        <Row gutter={8} align="middle">
          <Col flex="auto">
            <Form.Item
              name="baseUrl"
              label="请求地址"
              rules={[
                { required: true, message: '请输入请求地址' },
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
          </Col>
          <Col flex="none">
            <Form.Item name="isCompleteUrl" label="完整 URL" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Col>
        </Row>
        <ProviderModelsTable
          models={models}
          onChange={setModels}
          onFetchModels={handleFetchModels}
          fetching={fetching}
          hasFetchModels={presetKey !== CUSTOM_PRESET}
          baseUrl={baseUrl}
        />
        <Form.Item
          name="timeoutMs"
          label="超时 (ms)"
          rules={[{ required: true, message: '请输入超时时间' }]}
        >
          <InputNumber min={1000} step={1000} className="w-full" />
        </Form.Item>
      </Form>
    </Modal>
  )
}

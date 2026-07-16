import { App, Button, Form, Input, InputNumber } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { CompanionSettings, ModelProvider } from '@/api/system-config'
import { getProviders } from '@/features/model-providers/services'
import { getCategoryConfig, saveCategoryConfig } from '../services'
import { ProviderModelCascader } from './ProviderModelCascader'

export function CompanionSettingsForm() {
  const { message } = App.useApp()
  const [form] = Form.useForm<CompanionSettings>()
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [all, config] = await Promise.all([getProviders(), getCategoryConfig('companion')])
      setProviders(Object.values(all))
      if (config) {
        form.setFieldsValue({
          provider: config.provider,
          defaultBoundaries: config.defaultBoundaries ?? '',
          defaultGuardrailsPrompt: config.defaultGuardrailsPrompt ?? '',
          maxUserCompanions: config.maxUserCompanions ?? 10,
        })
      }
    } catch {
      message.error('加载失败，请稍后重试')
    }
  }, [form, message])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const ok = await saveCategoryConfig('companion', values)
      if (ok) message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical" initialValues={{ maxUserCompanions: 10 }}>
      <Form.Item name="provider" label="Companion 模型">
        <ProviderModelCascader
          providers={providers}
          modelType="llm"
          placeholder="选择 Companion LLM 模型"
        />
      </Form.Item>
      <Form.Item
        name="defaultBoundaries"
        label="自定义伴侣全局边界"
        extra="作为用户自定义伴侣的行为边界权威源；运行时始终合并，非创建快照"
      >
        <Input.TextArea rows={3} maxLength={2000} placeholder="可选" />
      </Form.Item>
      <Form.Item
        name="defaultGuardrailsPrompt"
        label="自定义伴侣全局安全提示词"
        extra="为空时使用服务端代码兜底安全模板"
      >
        <Input.TextArea rows={3} maxLength={3000} placeholder="可选" />
      </Form.Item>
      <Form.Item
        name="maxUserCompanions"
        label="每用户自定义伴侣上限"
        rules={[
          { required: true, message: '请设置上限' },
          { type: 'number', min: 1, max: 100, message: '范围 1–100' },
        ]}
        extra="仅统计 draft/published；archived 不占名额。默认 10"
      >
        <InputNumber min={1} max={100} style={{ width: 160 }} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}

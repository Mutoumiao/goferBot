import { Button, Form, message, Select, Slider } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { ChatSettings, ModelProvider } from '@/api/system-config'
import { getProviders } from '@/features/model-providers/services'
import { getCategoryConfig, saveCategoryConfig } from '../services'

export function ChatSettingsForm() {
  const [form] = Form.useForm<ChatSettings>()
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [all, config] = await Promise.all([getProviders(), getCategoryConfig('chat')])
      const list = Object.values(all).filter((p) => p.type === 'llm')
      setProviders(list)
      if (config) {
        form.setFieldsValue({
          enabledProviders: config.enabledProviders ?? [],
          defaultProvider: config.defaultProvider,
          temperature: config.temperature ?? 0.7,
        })
      }
    } catch {
      message.error('加载失败，请稍后重试')
    }
  }, [form])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const ok = await saveCategoryConfig('chat', values)
      if (ok) message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  const llmOptions = providers.map((p) => ({ value: p.id, label: `${p.name} (${p.model})` }))

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="defaultProvider" label="默认 Provider">
        <Select allowClear options={llmOptions} placeholder="选择默认 LLM Provider" />
      </Form.Item>
      <Form.Item name="enabledProviders" label="启用的 Providers">
        <Select
          mode="multiple"
          allowClear
          options={llmOptions}
          placeholder="选择启用的 LLM Providers"
        />
      </Form.Item>
      <Form.Item name="temperature" label="Temperature">
        <Slider min={0} max={2} step={0.1} />
      </Form.Item>
      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}

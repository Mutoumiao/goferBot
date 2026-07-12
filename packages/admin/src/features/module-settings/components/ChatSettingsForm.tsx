import { App, Button, Form, Slider } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { ChatSettings, ModelProvider } from '@/api/system-config'
import { getProviders } from '@/features/model-providers/services'
import { getCategoryConfig, saveCategoryConfig } from '../services'
import { ProviderModelCascader } from './ProviderModelCascader'

export function ChatSettingsForm() {
  const { message } = App.useApp()
  const [form] = Form.useForm<ChatSettings>()
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [all, config] = await Promise.all([getProviders(), getCategoryConfig('chat')])
      setProviders(Object.values(all))
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
  }, [form, message])

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

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="defaultProvider" label="默认模型">
        <ProviderModelCascader
          providers={providers}
          modelType="llm"
          placeholder="选择默认 LLM 模型"
        />
      </Form.Item>
      <Form.Item name="enabledProviders" label="启用的模型">
        <ProviderModelCascader
          providers={providers}
          modelType="llm"
          multiple
          placeholder="选择启用的 LLM 模型"
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

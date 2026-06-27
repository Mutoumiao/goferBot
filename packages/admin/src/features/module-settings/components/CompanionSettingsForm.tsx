import { Button, Form, message, Select } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { CompanionSettings, ModelProvider } from '@/api/system-config'
import { getProviders } from '@/features/model-providers/services'
import { getCategoryConfig, saveCategoryConfig } from '../services'

export function CompanionSettingsForm() {
  const [form] = Form.useForm<CompanionSettings>()
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [all, config] = await Promise.all([getProviders(), getCategoryConfig('companion')])
      setProviders(Object.values(all).filter((p) => p.type === 'llm'))
      if (config) {
        form.setFieldsValue({ provider: config.provider })
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
      const ok = await saveCategoryConfig('companion', values)
      if (ok) message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  const options = providers.map((p) => ({ value: p.id, label: `${p.name} (${p.model})` }))

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="provider" label="Provider">
        <Select allowClear options={options} placeholder="选择 LLM Provider" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}

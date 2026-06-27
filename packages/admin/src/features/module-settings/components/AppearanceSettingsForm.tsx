import { Button, Form, InputNumber, message, Select } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { AppearanceSettings } from '@/api/system-config'
import { getCategoryConfig, saveCategoryConfig } from '../services'

export function AppearanceSettingsForm() {
  const [form] = Form.useForm<AppearanceSettings>()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const config = await getCategoryConfig('appearance')
      if (config) {
        form.setFieldsValue({
          mode: config.mode ?? 'system',
          fontSizeLevel: config.fontSizeLevel ?? 3,
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
      const ok = await saveCategoryConfig('appearance', values)
      if (ok) message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="mode" label="主题模式">
        <Select
          options={[
            { value: 'light', label: '浅色' },
            { value: 'dark', label: '深色' },
            { value: 'system', label: '跟随系统' },
          ]}
        />
      </Form.Item>
      <Form.Item name="fontSizeLevel" label="字体大小">
        <InputNumber min={12} max={24} className="w-full" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}

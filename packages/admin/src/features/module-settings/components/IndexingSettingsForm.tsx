import { App, Button, Form, InputNumber, Switch } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { IndexingSettings } from '@/api/system-config'
import { getCategoryConfig, saveCategoryConfig } from '../services'

export function IndexingSettingsForm() {
  const { message } = App.useApp()
  const [form] = Form.useForm<IndexingSettings>()
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const config = await getCategoryConfig('indexing')
      if (config) {
        form.setFieldsValue({
          contextualEmbedding: config.contextualEmbedding ?? false,
          contextualWindow: config.contextualWindow ?? 1,
          parentChunkSize: config.parentChunkSize ?? 800,
          childChunkSize: config.childChunkSize ?? 150,
          synonymDict: config.synonymDict ?? { zh: {}, en: {} },
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
      const ok = await saveCategoryConfig('indexing', values)
      if (ok) message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="contextualEmbedding" label="Contextual Embedding" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="contextualWindow" label="Contextual Window">
        <InputNumber min={1} className="w-full" />
      </Form.Item>
      <Form.Item name="parentChunkSize" label="Parent Chunk Size">
        <InputNumber min={1} className="w-full" />
      </Form.Item>
      <Form.Item name="childChunkSize" label="Child Chunk Size">
        <InputNumber min={1} className="w-full" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}

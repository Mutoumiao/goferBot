import { Button, Form, InputNumber, message, Select } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { ModelProvider, RagSettings } from '@/api/system-config'
import { getProviders } from '@/features/model-providers/services'
import { getCategoryConfig, saveCategoryConfig } from '../services'

export function RagSettingsForm() {
  const [form] = Form.useForm<RagSettings>()
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [all, config] = await Promise.all([getProviders(), getCategoryConfig('rag')])
      setProviders(Object.values(all))
      if (config) {
        form.setFieldsValue({
          llmProvider: config.llmProvider,
          embeddingProvider: config.embeddingProvider,
          rerankerProvider: config.rerankerProvider,
          timeoutMs: config.timeoutMs ?? 30000,
          rerankerAllowedModelPrefixes: config.rerankerAllowedModelPrefixes ?? [],
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
      const ok = await saveCategoryConfig('rag', values)
      if (ok) message.success('保存成功')
    } finally {
      setSaving(false)
    }
  }

  const llmOptions = providers
    .filter((p) => p.type === 'llm')
    .map((p) => ({ value: p.id, label: `${p.name} (${p.model})` }))
  const embOptions = providers
    .filter((p) => p.type === 'embedding')
    .map((p) => ({ value: p.id, label: `${p.name} (${p.model})` }))
  const rerankOptions = providers
    .filter((p) => p.type === 'reranker')
    .map((p) => ({ value: p.id, label: `${p.name} (${p.model})` }))

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="llmProvider" label="LLM Provider">
        <Select allowClear options={llmOptions} placeholder="选择 LLM Provider" />
      </Form.Item>
      <Form.Item name="embeddingProvider" label="Embedding Provider">
        <Select allowClear options={embOptions} placeholder="选择 Embedding Provider" />
      </Form.Item>
      <Form.Item name="rerankerProvider" label="Reranker Provider">
        <Select allowClear options={rerankOptions} placeholder="选择 Reranker Provider（可选）" />
      </Form.Item>
      <Form.Item name="timeoutMs" label="超时 (ms)">
        <InputNumber min={1000} step={1000} className="w-full" />
      </Form.Item>
      <Form.Item name="rerankerAllowedModelPrefixes" label="允许的模型前缀">
        <Select mode="tags" allowClear placeholder="输入模型前缀并回车" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" loading={saving} onClick={handleSave}>
          保存
        </Button>
      </Form.Item>
    </Form>
  )
}

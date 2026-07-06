import { Button, Form, InputNumber, message, Select } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import type { ModelProvider, RagSettings } from '@/api/system-config'
import { getProviders } from '@/features/model-providers/services'
import { getCategoryConfig, saveCategoryConfig } from '../services'
import { ProviderModelCascader } from './ProviderModelCascader'

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

  return (
    <Form form={form} layout="vertical">
      <Form.Item name="llmProvider" label="LLM 模型">
        <ProviderModelCascader providers={providers} modelType="llm" placeholder="选择 LLM 模型" />
      </Form.Item>
      <Form.Item name="embeddingProvider" label="Embedding 模型">
        <ProviderModelCascader
          providers={providers}
          modelType="embedding"
          placeholder="选择 Embedding 模型"
        />
      </Form.Item>
      <Form.Item name="rerankerProvider" label="Reranker 模型">
        <ProviderModelCascader
          providers={providers}
          modelType="reranker"
          placeholder="选择 Reranker 模型（可选）"
        />
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

import type { FormInstance, FormListFieldData } from 'antd'
import { Button, Form, Input, InputNumber, Select, Switch } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { ProviderType } from '@/api/system-config'

const TYPE_OPTIONS: Array<{ value: ProviderType; label: string }> = [
  { value: 'llm', label: 'LLM' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'reranker', label: 'Reranker' },
  { value: 'document-parser', label: 'Document Parser' },
]

interface ProviderModelsTableProps {
  /** 获取模型列表回调，由父组件处理网络请求 */
  onFetchModels: () => Promise<void>
  fetching: boolean
  /** 是否显示一键获取模型列表按钮（自定义供应商不显示） */
  hasFetchModels?: boolean
}

interface ModelRowProps {
  field: FormListFieldData
  onRemove: () => void
  isLocal: boolean
}

/**
 * 单个模型行：名称 + 类型 + 启用 + 条件参数 + 删除。
 * R4: 本地 embedding 模型隐藏 dimensions 输入。
 */
function ModelRow({ field, onRemove, isLocal }: ModelRowProps) {
  const form = Form.useFormInstance() as FormInstance
  const type = Form.useWatch(['models', field.name, 'type'], form) as ProviderType | undefined

  const showDimensions = type === 'embedding' && !isLocal
  const showMaxLength = type === 'reranker'

  return (
    <div className="flex items-start gap-2 rounded border border-border-subtle p-2">
      <Form.Item
        name={[field.name, 'name']}
        className="mb-0 flex-1"
        rules={[{ required: true, message: '模型名不能为空' }]}
      >
        <Input placeholder="模型名，如 deepseek-chat" size="small" />
      </Form.Item>
      <Form.Item name={[field.name, 'type']} className="mb-0 w-32">
        <Select size="small" options={TYPE_OPTIONS} />
      </Form.Item>
      <Form.Item name={[field.name, 'enabled']} className="mb-0" valuePropName="checked">
        <Switch size="small" checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>
      {showDimensions && (
        <Form.Item name={[field.name, 'dimensions']} className="mb-0 w-24">
          <InputNumber size="small" placeholder="维度" min={1} className="w-full" />
        </Form.Item>
      )}
      {showMaxLength && (
        <Form.Item name={[field.name, 'maxLength']} className="mb-0 w-24">
          <InputNumber size="small" placeholder="maxLength" min={1} className="w-full" />
        </Form.Item>
      )}
      <Button
        type="text"
        danger
        size="small"
        icon={<Trash2 size={14} />}
        onClick={onRemove}
        className="shrink-0"
      />
    </div>
  )
}

/**
 * 模型列表表格：使用 Form.List 管理动态行。
 * 顶部按钮：[+ 添加模型] [一键获取模型列表]
 */
export function ProviderModelsTable({ onFetchModels, fetching, hasFetchModels = true }: ProviderModelsTableProps) {
  const form = Form.useFormInstance() as FormInstance
  const baseUrl = (Form.useWatch('baseUrl', form) as string | undefined) ?? ''
  const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl)

  return (
    <Form.List name="models">
      {(fields, { add, remove }) => (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">模型列表</span>
            <div className="flex gap-2">
              <Button
                size="small"
                icon={<Plus size={14} />}
                onClick={() => add({ name: '', type: 'llm' as ProviderType, enabled: true })}
              >
                添加模型
              </Button>
              {hasFetchModels && (
                <Button size="small" loading={fetching} onClick={() => void onFetchModels()}>
                  一键获取模型列表
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {fields.length === 0 && (
              <div className="rounded border border-dashed border-border-subtle py-4 text-center text-xs text-text-tertiary">
                {hasFetchModels
                  ? '暂无模型，点击「添加模型」或「一键获取模型列表」'
                  : '暂无模型，点击「添加模型」手动添加'}
              </div>
            )}
            {fields.map((field) => (
              <ModelRow
                key={field.key}
                field={field}
                onRemove={() => remove(field.name)}
                isLocal={isLocal}
              />
            ))}
          </div>
        </div>
      )}
    </Form.List>
  )
}

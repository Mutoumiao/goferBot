import { Button, Input, InputNumber, Select, Switch } from 'antd'
import { Plus, Trash2 } from 'lucide-react'
import type { Model, ProviderType } from '@/api/system-config'

const TYPE_OPTIONS: Array<{ value: ProviderType; label: string }> = [
  { value: 'llm', label: 'LLM' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'reranker', label: 'Reranker' },
  { value: 'document-parser', label: 'Document Parser' },
]

interface ProviderModelsTableProps {
  models: Model[]
  onChange: (models: Model[]) => void
  onFetchModels: () => Promise<void>
  fetching: boolean
  /** 是否显示一键获取模型列表按钮（自定义供应商不显示） */
  hasFetchModels?: boolean
  /** 用于判断本地 embedding 是否隐藏 dimensions */
  baseUrl?: string
}

interface ModelRowProps {
  model: Model
  onChange: (patch: Partial<Model>) => void
  onRemove: () => void
  isLocal: boolean
}

/**
 * 单个模型行：受控组件，不依赖 Form.List / Form.Item 路径同步。
 * R4: 本地 embedding 模型隐藏 dimensions 输入。
 */
function ModelRow({ model, onChange, onRemove, isLocal }: ModelRowProps) {
  const showDimensions = model.type === 'embedding' && !isLocal
  const showMaxLength = model.type === 'reranker'

  return (
    <div className="flex items-start gap-2 rounded border border-border-subtle p-2">
      <Input
        className="flex-1"
        placeholder="模型名，如 deepseek-chat"
        size="small"
        value={model.name}
        status={model.name.trim() ? undefined : 'error'}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <Select
        className="w-32"
        size="small"
        options={TYPE_OPTIONS}
        value={model.type}
        onChange={(type: ProviderType) => onChange({ type })}
      />
      <Switch
        size="small"
        checkedChildren="启用"
        unCheckedChildren="禁用"
        checked={model.enabled}
        onChange={(enabled) => onChange({ enabled })}
      />
      {showDimensions && (
        <InputNumber
          className="w-24"
          size="small"
          placeholder="维度"
          min={1}
          value={model.dimensions}
          onChange={(dimensions) =>
            onChange({ dimensions: dimensions === null ? undefined : dimensions })
          }
        />
      )}
      {showMaxLength && (
        <InputNumber
          className="w-24"
          size="small"
          placeholder="maxLength"
          min={1}
          value={model.maxLength}
          onChange={(maxLength) =>
            onChange({ maxLength: maxLength === null ? undefined : maxLength })
          }
        />
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
 * 模型列表表格：完全受控（models + onChange），保证一键获取后 UI 必定刷新。
 */
export function ProviderModelsTable({
  models,
  onChange,
  onFetchModels,
  fetching,
  hasFetchModels = true,
  baseUrl = '',
}: ProviderModelsTableProps) {
  const isLocal = /localhost|127\.0\.0\.1/.test(baseUrl)

  const handleAdd = () => {
    onChange([...models, { name: '', type: 'llm' as ProviderType, enabled: true }])
  }

  const handlePatch = (index: number, patch: Partial<Model>) => {
    onChange(models.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const handleRemove = (index: number) => {
    onChange(models.filter((_, i) => i !== index))
  }

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">模型列表</span>
        <div className="flex gap-2">
          <Button size="small" icon={<Plus size={14} />} onClick={handleAdd}>
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
        {models.length === 0 && (
          <div className="rounded border border-dashed border-border-subtle py-4 text-center text-xs text-text-tertiary">
            {hasFetchModels
              ? '暂无模型，点击「添加模型」或「一键获取模型列表」'
              : '暂无模型，点击「添加模型」手动添加'}
          </div>
        )}
        {models.map((model, index) => (
          <ModelRow
            key={`${model.name}-${index}`}
            model={model}
            onChange={(patch) => handlePatch(index, patch)}
            onRemove={() => handleRemove(index)}
            isLocal={isLocal}
          />
        ))}
      </div>
    </div>
  )
}

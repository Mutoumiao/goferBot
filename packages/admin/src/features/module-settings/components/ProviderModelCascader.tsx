import { Cascader } from 'antd'
import type { ModelProvider, ProviderType } from '@/api/system-config'

interface ProviderModelCascaderProps {
  /** 当前值：单选为模型 key 字符串，多选为 key 字符串数组 */
  value?: string | string[]
  /** 值变更回调：单选返回 string，多选返回 string[] */
  onChange?: (value: string | string[] | undefined) => void
  /** providers 列表（来自 admin providers 接口） */
  providers: ModelProvider[]
  /** 筛选的模型类型 */
  modelType: ProviderType
  /** 是否多选 */
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
}

const MODEL_KEY_SEPARATOR = '#'

/** 模型 key → Cascader path：['providerId', 'providerId#modelName'] */
function keyToPath(key: string): string[] {
  const idx = key.indexOf(MODEL_KEY_SEPARATOR)
  return idx === -1 ? [key] : [key.slice(0, idx), key]
}

/** 构建 Cascader 选项：provider → enabled 模型（按类型筛选） */
function buildOptions(providers: ModelProvider[], modelType: ProviderType) {
  return providers
    .filter((p) => p.enabled)
    .map((p) => ({
      value: p.id,
      label: p.name,
      children: p.models
        .filter((m) => m.type === modelType && m.enabled)
        .map((m) => ({
          value: `${p.id}${MODEL_KEY_SEPARATOR}${m.name}`,
          label: m.name,
        })),
    }))
    .filter((opt) => opt.children.length > 0)
}

/**
 * Provider → Model 级联选择器。
 * 单选 value 为 `{providerId}#{modelName}` 字符串；
 * 多选 value 为该格式字符串数组。
 * 内部自动在 Cascader path 与模型 key 之间转换。
 */
export function ProviderModelCascader({
  value,
  onChange,
  providers,
  modelType,
  multiple = false,
  placeholder = '选择模型',
  disabled = false,
}: ProviderModelCascaderProps) {
  const options = buildOptions(providers, modelType)

  const cascaderValue = multiple
    ? ((value as string[] | undefined) ?? []).map(keyToPath)
    : value
      ? keyToPath(value as string)
      : undefined

  const handleChange = (path: unknown) => {
    if (!onChange) return
    if (multiple) {
      const paths = path as string[][]
      onChange(paths.map((p) => p[p.length - 1]))
    } else {
      const p = path as string[]
      onChange(p?.[p.length - 1])
    }
  }

  const commonProps = {
    options,
    placeholder,
    disabled,
    allowClear: true as const,
    changeOnSelect: false as const,
    expandTrigger: 'hover' as const,
    onChange: handleChange,
  }

  // antd Cascader 的 multiple 是判别联合类型，需分支渲染以正确收窄类型
  if (multiple) {
    return <Cascader {...commonProps} multiple value={cascaderValue as string[][]} />
  }
  return <Cascader {...commonProps} value={cascaderValue as string[] | undefined} />
}

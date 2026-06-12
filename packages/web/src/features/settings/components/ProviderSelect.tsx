import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProviderOption {
  key: string
  name: string
  model: string
}

interface ProviderSelectProps {
  value: string
  options: ProviderOption[]
  onChange: (value: string) => void
}

export function ProviderSelect({ value, options, onChange }: ProviderSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="请选择模型" />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 && (
          <SelectItem value="_empty" disabled>
            暂无可用模型
          </SelectItem>
        )}
        {options.map((opt) => (
          <SelectItem key={opt.key} value={opt.key}>
            {opt.name} ({opt.model})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

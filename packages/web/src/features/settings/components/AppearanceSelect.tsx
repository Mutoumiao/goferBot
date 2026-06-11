import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const OPTIONS = [
  { value: 'light' as const, label: '浅色模式' },
  { value: 'dark' as const, label: '深色模式' },
  { value: 'system' as const, label: '跟随系统' },
]

interface AppearanceSelectProps {
  value: 'light' | 'dark' | 'system'
  onChange: (value: 'light' | 'dark' | 'system') => void
}

export function AppearanceSelect({ value, onChange }: AppearanceSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

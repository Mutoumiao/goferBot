import { SettingsRow } from './SettingsRow'
import { Button } from '@/components/ui/button'
import { PlusIcon } from 'lucide-react'
import type { ProviderConfig } from '@/utils/llm-config'

interface CustomProviderListProps {
  providers: Record<string, ProviderConfig>
  onEdit: (key: string) => void
  onDelete: (key: string) => void
  onAdd: () => void
}

export function CustomProviderList({ providers, onEdit, onDelete, onAdd }: CustomProviderListProps) {
  const customEntries = Object.entries(providers).filter(([key]) =>
    key.startsWith('custom_')
  )

  return (
    <>
      {customEntries.map(([key, provider]) => (
        <SettingsRow key={key} label={provider.name || '未命名模型'}>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => onEdit(key)}>
              编辑
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(key)}>
              删除
            </Button>
          </div>
        </SettingsRow>
      ))}
      <div className="flex items-center gap-2 px-4 py-4 cursor-pointer text-primary" onClick={onAdd}>
        <PlusIcon className="size-4" />
        <span className="text-sm">添加自定义模型</span>
      </div>
    </>
  )
}

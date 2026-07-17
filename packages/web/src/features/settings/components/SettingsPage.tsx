import { useRef, useState } from 'react'
import { SettingsSurface } from '@/components/layout/SettingsSurface'
import { AppearanceSelect } from '@/features/settings/components/AppearanceSelect'
import { CustomProviderList } from '@/features/settings/components/CustomProviderList'
import { FontSizeSlider } from '@/features/settings/components/FontSizeSlider'
import { ProviderDialog } from '@/features/settings/components/ProviderDialog'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { useSettingsServices } from '@/features/settings/services'
import { useKeepAliveSilentRefresh } from '@/lib/route-keepalive'
import { ConfirmDialog } from '@/overlays/dialogs/ConfirmDialog'
import type { ProviderConfig } from '@/utils/llm-config'

export function SettingsPage() {
  const svc = useSettingsServices()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const loadSettingsRef = useRef(svc.loadSettings)
  loadSettingsRef.current = svc.loadSettings

  // 首次进入与二次切回均拉最新设置；配置区无整页骨架，覆盖即可
  useKeepAliveSilentRefresh(() => {
    void loadSettingsRef.current()
  })

  const editingProvider = editingKey ? svc.config.providers[editingKey] : undefined

  const handleAdd = () => {
    setEditingKey(null)
    setDialogOpen(true)
  }

  const handleEdit = (key: string) => {
    setEditingKey(key)
    setDialogOpen(true)
  }

  const handleDelete = (key: string) => {
    setDeletingKey(key)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = () => {
    if (deletingKey) {
      svc.removeCustomProvider(deletingKey)
    }
  }

  const handleSubmit = (data: ProviderConfig) => {
    if (editingKey) {
      svc.updateCustomProvider(editingKey, data)
    } else {
      svc.addCustomProvider(data)
    }
  }

  return (
    <SettingsSurface testId="settings-page">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
          Preferences
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text-primary">设置</h1>
        <p className="mt-1.5 text-sm text-text-secondary">外观、字体与自定义模型</p>
      </header>

      <div className="space-y-5">
        <SettingsSection title="通用设置">
          <SettingsRow label="界面显示">
            <AppearanceSelect value={svc.config.appearance} onChange={svc.saveAppearance} />
          </SettingsRow>
          <SettingsRow label="字体大小" showDivider={false}>
            <FontSizeSlider value={svc.config.fontSizeLevel} onChange={svc.saveFontSizeLevel} />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="我的模型">
          <CustomProviderList
            providers={svc.config.providers}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        </SettingsSection>

        <SettingsSection title="关于">
          <SettingsRow label="版本号" showDivider={false}>
            <span className="text-sm text-text-secondary">1.0.0</span>
          </SettingsRow>
        </SettingsSection>
      </div>

      <ProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingProvider}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="删除模型"
        description="确定删除该模型吗？此操作不可撤销。"
        confirmText="删除"
        onConfirm={handleConfirmDelete}
      />
    </SettingsSurface>
  )
}

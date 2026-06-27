import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppearanceSelect } from '@/features/settings/components/AppearanceSelect'
import { CustomProviderList } from '@/features/settings/components/CustomProviderList'
import { FontSizeSlider } from '@/features/settings/components/FontSizeSlider'
import { ProviderDialog } from '@/features/settings/components/ProviderDialog'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { useSettingsServices } from '@/features/settings/services'
import { ConfirmDialog } from '@/overlays/dialogs/ConfirmDialog'
import { ROUTES_REGISTER } from '@/router-register'
import type { ProviderConfig } from '@/utils/llm-config'

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
  staticData: {
    meta: ROUTES_REGISTER.settings,
  },
})

function SettingsPage() {
  const svc = useSettingsServices()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  useEffect(() => {
    svc.loadSettings()
    // ponytail: 设置加载只需在挂载时执行一次，使用空依赖数组
  }, [])

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
    <div className="h-full p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-6">设置</h1>

      <div className="space-y-6">
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
            <span className="text-sm text-muted-foreground">1.0.0</span>
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
    </div>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useSettingsServices } from '@/features/settings/services'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { AppearanceSelect } from '@/features/settings/components/AppearanceSelect'
import { FontSizeSlider } from '@/features/settings/components/FontSizeSlider'
import { ProviderSelect } from '@/features/settings/components/ProviderSelect'
import { CustomProviderList } from '@/features/settings/components/CustomProviderList'
import { ProviderDialog } from '@/features/settings/components/ProviderDialog'
import { configuredProviders } from '@/utils/llm-config'
import type { ProviderConfig } from '@/utils/llm-config'
import { ROUTES_REGISTER } from '@/router-register'

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

  useEffect(() => {
    svc.loadSettings()
  }, [])

  const providerOptions = configuredProviders(svc.config)
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
    if (confirm('确定删除该模型吗？')) {
      svc.removeCustomProvider(key)
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

        <SettingsSection title="首选模型">
          <SettingsRow label="默认模型" showDivider={false}>
            <ProviderSelect
              value={svc.config.defaultChatProvider}
              options={providerOptions}
              onChange={svc.saveDefaultProvider}
            />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection title="自定义模型">
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
    </div>
  )
}

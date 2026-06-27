import { Card, Tabs } from 'antd'
import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { AppearanceSettingsForm } from './AppearanceSettingsForm'
import { ChatSettingsForm } from './ChatSettingsForm'
import { CompanionSettingsForm } from './CompanionSettingsForm'
import { IndexingSettingsForm } from './IndexingSettingsForm'
import { RagSettingsForm } from './RagSettingsForm'

const categories = [
  { key: 'chat', label: 'Chat', component: ChatSettingsForm },
  { key: 'rag', label: 'RAG', component: RagSettingsForm },
  { key: 'companion', label: 'Companion', component: CompanionSettingsForm },
  { key: 'indexing', label: 'Indexing', component: IndexingSettingsForm },
  { key: 'appearance', label: 'Appearance', component: AppearanceSettingsForm },
] as const

export function ModuleSettingsLayout() {
  const [activeKey, setActiveKey] = useState<string>('chat')

  const ActiveComponent = categories.find((c) => c.key === activeKey)?.component ?? ChatSettingsForm

  return (
    <div className="space-y-4">
      <PageHeader title="模块配置" description="管理各业务模块的默认模型与行为参数" />
      <Card>
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={categories.map((c) => ({ key: c.key, label: c.label }))}
        />
        <div className="pt-4">
          <ActiveComponent />
        </div>
      </Card>
    </div>
  )
}

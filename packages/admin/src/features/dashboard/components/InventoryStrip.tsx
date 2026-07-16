import type { HubInventory } from '@goferbot/data'

export interface InventoryStripProps {
  inventory?: HubInventory
}

export function InventoryStrip({ inventory }: InventoryStripProps) {
  const items = [
    { label: '用户', value: inventory?.userCount },
    { label: '知识库', value: inventory?.knowledgeBaseCount },
    { label: '文档', value: inventory?.documentCount },
    { label: '伴侣', value: inventory?.companionCount },
  ]

  return (
    <section className="obs-rise obs-rise-4">
      <p className="obs-section-label">规模（弱化）</p>
      <div className="obs-inventory">
        {items.map((item) => (
          <div key={item.label} className="obs-inventory__cell">
            <div className="obs-inventory__value">
              {item.value != null ? item.value.toLocaleString() : '—'}
            </div>
            <div className="obs-inventory__label">{item.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

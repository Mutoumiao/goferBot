import { useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { getKbList } from '@/api/kb'
import { useKbStore } from '@/stores/kb'

export const Route = createFileRoute('/app/kb')({
  component: KbListPage,
})

function KbListPage() {
  const { entries, isLoading, setEntries, setIsLoading } = useKbStore()

  const { send } = useRequest(() => getKbList(), { immediate: false })

  useEffect(() => {
    setIsLoading(true)
    send()
      .then((res) => {
        const data = (res as { data?: { entries?: unknown[] } })?.data
        if (data?.entries) setEntries(data.entries as never[])
      })
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <div className="h-full p-6">
      <h1 className="text-xl font-bold text-text-primary">知识库</h1>
      <p className="mt-1 text-sm text-text-secondary">管理你的知识库文档</p>

      {isLoading ? (
        <div className="mt-8 text-center text-sm text-text-secondary">加载中...</div>
      ) : entries.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-text-secondary">暂无知识库</p>
          <p className="mt-2 text-xs text-text-tertiary">点击右上角 + 创建知识库</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-border-default bg-surface-1 p-4 hover:shadow-sm transition-shadow cursor-pointer"
            >
              <h3 className="font-medium text-text-primary">{entry.title}</h3>
              {entry.description && (
                <p className="mt-1 text-xs text-text-secondary line-clamp-2">{entry.description}</p>
              )}
              <div className="mt-3 flex items-center gap-2 text-xs text-text-tertiary">
                <span>📄 {entry.fileCount ?? 0} 个文件</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 记忆管理 UI 纯逻辑（G-MM-03 / IT-MM-ui）
 * 与 CompanionMemoriesPage 共用，便于黄金测试。
 */
import type { Memory, MemoryFilter, MemoryType } from './types'
import { MEMORY_TYPE_LABELS } from './types'

export const MEMORY_FILTER_OPTIONS: { value: MemoryFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  ...(Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((type) => ({
    value: type as MemoryFilter,
    label: MEMORY_TYPE_LABELS[type],
  })),
]

/** 按类型筛选列表（all = 不过滤） */
export function filterMemoriesByType(memories: Memory[], filter: MemoryFilter): Memory[] {
  if (filter === 'all') return memories
  return memories.filter((m) => m.type === filter)
}

/** 启用/停用切换：active ↔ disabled */
export function nextMemoryToggleStatus(
  status: Memory['status'],
): 'active' | 'disabled' {
  return status === 'active' ? 'disabled' : 'active'
}

/** 列表中替换已更新记忆 */
export function replaceMemoryInList(memories: Memory[], updated: Memory): Memory[] {
  return memories.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
}

/** 列表中移除记忆（软删后 UI 侧剔除） */
export function removeMemoryFromList(memories: Memory[], memoryId: string): Memory[] {
  return memories.filter((m) => m.id !== memoryId)
}

/** 编辑内容是否可提交 */
export function canSaveMemoryEdit(content: string | null | undefined): boolean {
  return Boolean(content?.trim())
}

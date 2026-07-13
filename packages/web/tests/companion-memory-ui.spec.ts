/**
 * IT-MM-ui / UT-MM-ui：记忆管理页纯逻辑（筛选、状态切换、列表更新）
 */
import { describe, expect, it } from 'vitest'
import {
  canSaveMemoryEdit,
  filterMemoriesByType,
  MEMORY_FILTER_OPTIONS,
  nextMemoryToggleStatus,
  removeMemoryFromList,
  replaceMemoryInList,
} from '../src/features/companion/memory-ui'
import type { Memory, MemoryType } from '../src/features/companion/types'
import { MEMORY_TYPE_LABELS } from '../src/features/companion/types'

function mem(partial: Partial<Memory> & Pick<Memory, 'id' | 'type' | 'content'>): Memory {
  return {
    companionId: 'c1',
    importance: 3,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('IT-MM-ui memory management UI helpers', () => {
  it('MEMORY_FILTER_OPTIONS 含全部 + 五类 MemoryType', () => {
    expect(MEMORY_FILTER_OPTIONS[0]).toEqual({ value: 'all', label: '全部' })
    expect(MEMORY_FILTER_OPTIONS).toHaveLength(1 + Object.keys(MEMORY_TYPE_LABELS).length)
    for (const type of Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]) {
      expect(MEMORY_FILTER_OPTIONS.some((o) => o.value === type)).toBe(true)
      expect(MEMORY_FILTER_OPTIONS.find((o) => o.value === type)?.label).toBe(
        MEMORY_TYPE_LABELS[type],
      )
    }
  })

  it('filterMemoriesByType: all 与按 type', () => {
    const list = [
      mem({ id: '1', type: 'preference', content: '猫' }),
      mem({ id: '2', type: 'boundary', content: '政治' }),
      mem({ id: '3', type: 'preference', content: '茶' }),
    ]
    expect(filterMemoriesByType(list, 'all')).toHaveLength(3)
    const prefs = filterMemoriesByType(list, 'preference')
    expect(prefs).toHaveLength(2)
    expect(prefs.every((m) => m.type === 'preference')).toBe(true)
    expect(filterMemoriesByType(list, 'boundary')).toEqual([list[1]])
  })

  it('nextMemoryToggleStatus: active ↔ disabled', () => {
    expect(nextMemoryToggleStatus('active')).toBe('disabled')
    expect(nextMemoryToggleStatus('disabled')).toBe('active')
  })

  it('replaceMemoryInList / removeMemoryFromList', () => {
    const list = [
      mem({ id: 'a', type: 'preference', content: '旧' }),
      mem({ id: 'b', type: 'boundary', content: '边界' }),
    ]
    const updated = mem({ id: 'a', type: 'preference', content: '新', status: 'disabled' })
    const after = replaceMemoryInList(list, updated)
    expect(after.find((m) => m.id === 'a')?.content).toBe('新')
    expect(after.find((m) => m.id === 'a')?.status).toBe('disabled')
    expect(after.find((m) => m.id === 'b')?.content).toBe('边界')

    const removed = removeMemoryFromList(after, 'a')
    expect(removed).toHaveLength(1)
    expect(removed[0]?.id).toBe('b')
  })

  it('canSaveMemoryEdit: 非空 trim 才可保存', () => {
    expect(canSaveMemoryEdit('  hi  ')).toBe(true)
    expect(canSaveMemoryEdit('')).toBe(false)
    expect(canSaveMemoryEdit('   ')).toBe(false)
    expect(canSaveMemoryEdit(null)).toBe(false)
    expect(canSaveMemoryEdit(undefined)).toBe(false)
  })
})

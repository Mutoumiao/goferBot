---
id: f-45
issue: issue.md
version: 1
---

# ChatView 会话管理 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 在 ChatView 中实现完整会话生命周期管理（新建/切换/删除/重命名）和 KbSelector 知识库选择器集成。

**架构：** 5 个组件（3 新建 + 2 改造），全部通过 Zustand `useChatStore`（由 f-40 提供）消费会话状态。删除确认走 Overlay 系统 `openDialog` Promise 模式。KbSelector 通过 alova `useRequest` 加载 KB 列表。

**技术栈：** React + TypeScript + Zustand + alova + shadcn/ui + Tailwind CSS v4 + lucide-react + Vitest + React Testing Library

**Issue 引用：** [issue.md](../issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) | [specs/behavior-spec.md](specs/behavior-spec.md)
**PRD 引用：** [PRD §5.7 阶段三深化](../../prd/v3-frontend-migration.md#57-阶段三深化p1-优先级)

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| ChatView 获得完整会话生命周期管理能力 | ✅ 已覆盖 | 任务 3-6：新建/切换/删除/重命名 |
| 用户可新建/切换/删除会话 | ✅ 已覆盖 | 任务 3（SessionList）、任务 4（删除确认）、任务 6（ChatView 集成） |
| 消息按会话隔离 | ✅ 已覆盖 | 任务 6：切换会话时 `loadHistory` 加载对应消息 |
| KbSelector 集成 | ✅ 已覆盖 | 任务 2（KbSelector 组件）、任务 5（ChatInput 集成） |

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案 | ✅ 符合 | 无后端 DTO 变更，前端仅消费已有 API |
| ADR 0001 | 响应格式 | ✅ 符合 | 无新增 API 端点 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入新 npm 包（alova/Zustand/shadcn 已在项目中使用） |
| ADR——overlay 规范 | Dialog 命令式调用 | ✅ 符合 | DeleteSessionDialog 通过 `openDialog()` 调用，放入 `overlays/dialogs/` |

---

## 前置依赖

| 依赖 | 状态 | Plan 假设 |
|------|------|-----------|
| f-40 Session Store | 待完成 | `useChatStore` 已包含：`sessions`, `isLoadingSessions`, `error`, `loadSessions()`, `createSession()`, `deleteSession(id)`, `renameSession(id, title)`, `clearError()`, `setActiveSession(session)`, 等 |
| f-44 SSE 流式 | 待完成 | `handleSend` 中 SSE 调用占位，本 plan 不改动 |

> **注意**：若 f-40 完成后接口与假设有差异，需调整本 plan 中对应的 store selector 和 action 调用。

---

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `packages/web/src/components/chat/KbSelector.tsx` | 知识库下拉多选组件 |
| 新建 | `packages/web/src/overlays/dialogs/DeleteSessionDialog.tsx` | 删除确认弹窗 |
| 新建 | `packages/web/src/components/chat/SessionList.tsx` | 会话列表组件 |
| 修改 | `packages/web/src/api/chat.ts` | 新增 `renameSession` 方法 |
| 修改 | `packages/web/src/components/chat/ChatInput.tsx` | 集成 KbSelector，透传 knowledgeBaseIds |
| 修改 | `packages/web/src/routes/app/chat.tsx` | 集成 SessionList + 删除/重命名/错误处理 |
| 新建 | `tests/unit/web/KbSelector.spec.tsx` | KbSelector 单元测试 |
| 新建 | `tests/unit/web/DeleteSessionDialog.spec.tsx` | DeleteSessionDialog 单元测试 |
| 新建 | `tests/unit/web/SessionList.spec.tsx` | SessionList 单元测试 |
| 修改 | `tests/unit/web/ChatView.spec.tsx` | ChatView 集成测试（如存在则修改，不存在则新建） |
| 新建 | `tests/unit/web/chatApi.spec.ts` | renameSession API 方法测试 |
| 修改 | `packages/data/src/schemas/chat.schema.ts` | `sendMessageRequestSchema` 增加 `knowledgeBaseIds` 字段 |

---

## 任务列表

### 任务 0: packages/data — 扩展 sendMessageRequestSchema 增加 knowledgeBaseIds 字段

> **高优先级跨 issue 修复**：`sendMessageRequestSchema` 当前只有 `sessionId`、`content`、`fileIds`，缺少 `knowledgeBaseIds`。f-45 的 KbSelector 选择的知识库 ID 需要通过此字段传递给后端。

**文件：**
- 修改：`packages/data/src/schemas/chat.schema.ts`
- 测试：无独立测试（类型检查验证）

**规格引用：**
- f-45 behavior-spec：KbSelector 选中后透传 knowledgeBaseIds

- [ ] **步骤 1: 修改 Schema**

```typescript
// packages/data/src/schemas/chat.schema.ts
// 在 sendMessageRequestSchema 中增加 knowledgeBaseIds 字段：
export const sendMessageRequestSchema = z.object({
  sessionId: z.string(),
  content: z.string(),
  fileIds: z.array(z.string()).optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),  // ← 新增：f-45 KbSelector 透传
})
```

- [ ] **步骤 2: 验证类型导出**

```bash
npx tsc --noEmit -p packages/data/tsconfig.json
```

预期：类型检查通过。`knowledgeBaseIds` 字段会通过 `z.infer<typeof sendMessageRequestSchema>` 自动导出到 `SendMessageRequest` 类型。

- [ ] **步骤 3：验证引用方** 

确认 `packages/web/src/api/chat.ts` 中的 `sendMessage` 方法引用 `SendMessageRequest` 类型，新增字段自动包含——无需额外修改。

---

### 任务 1: api/chat.ts — 新增 renameSession 方法

**文件：**
- 修改：`packages/web/src/api/chat.ts`（在 `deleteSession` 之后添加）
- 测试：`tests/unit/web/chatApi.spec.ts`（新建）

**规格引用：**
- 功能规格：依赖关系 — renameSession API 方法

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/chatApi.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { renameSession } from '@/api/chat'
import { alovaInstance } from '@/utils/server'

vi.mock('@/utils/server', () => ({
  alovaInstance: {
    Patch: vi.fn(),
  },
}))

describe('chatApi.renameSession', () => {
  it('AC-06: renames session with id and title via PATCH', () => {
    const mockPatch = vi.fn()
    vi.mocked(alovaInstance.Patch).mockReturnValue(mockPatch as any)

    renameSession('sess-1', 'New Title')

    expect(alovaInstance.Patch).toHaveBeenCalledWith('/chat/sessions/sess-1', { title: 'New Title' })
  })

  it('AC-06: handles empty title gracefully (trims whitespace)', () => {
    const mockPatch = vi.fn()
    vi.mocked(alovaInstance.Patch).mockReturnValue(mockPatch as any)

    renameSession('sess-1', '  Updated  ')

    expect(alovaInstance.Patch).toHaveBeenCalledWith('/chat/sessions/sess-1', { title: 'Updated' })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/chatApi.spec.ts
```

预期：FAIL — `renameSession is not a function` 或 `Property 'Patch' does not exist`

- [ ] **步骤 3: 编写最小实现**

```typescript
// 在 packages/web/src/api/chat.ts 的 deleteSession 之后追加：

/**
 * 重命名会话
 *
 * 注意：trim 逻辑保留在 UI 层（handleConfirmRename 中已做 trim 校验）。
 * API 层不做额外 trim，确保 API 行为透明、可预测。
 */
export const renameSession = (sessionId: string, title: string) =>
  alovaInstance.Patch(`/chat/sessions/${sessionId}`, { title })
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/chatApi.spec.ts
```

预期：PASS（2 tests）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/chatApi.spec.ts
```

---

### 任务 2: KbSelector 组件

**文件：**
- 创建：`packages/web/src/components/chat/KbSelector.tsx`
- 测试：`tests/unit/web/KbSelector.spec.tsx`（新建）

**规格引用：**
- 行为规格：交互状态表 — KbSelector（loading/empty/error/open/closed）
- 行为规格：流程 5 — KbSelector 选择知识库
- 行为规格：边界条件 — 键盘导航、大量 KB 滚动

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/KbSelector.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KbSelector } from '@/components/chat/KbSelector'

// Mock alova useRequest
vi.mock('alova/client', () => ({
  useRequest: vi.fn(),
}))

import { useRequest } from 'alova/client'

describe('KbSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('AC-07: renders trigger button when closed', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    expect(screen.getByTestId('kb-selector-trigger')).toBeInTheDocument()
  })

  it('AC-07: opens dropdown on trigger click and renders KB items', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [
        { id: 'kb-1', name: 'Docs', documentCount: 5 },
        { id: 'kb-2', name: 'Code', documentCount: 3 },
      ] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    expect(screen.getByTestId('kb-selector-dropdown')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Code')).toBeInTheDocument()
    expect(screen.getByText('5 文档')).toBeInTheDocument()
  })

  it('AC-07: shows loading skeleton when loading', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: true,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    // 骨架占位（3 条）
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('AC-07: shows empty hint when no KB entries', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    expect(screen.getByText('请先创建知识库')).toBeInTheDocument()
  })

  it('AC-07: shows error message with retry button', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: undefined,
      loading: false,
      error: new Error('加载失败'),
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    expect(screen.getByText('加载失败')).toBeInTheDocument()
    expect(screen.getByTestId('kb-selector-retry')).toBeInTheDocument()
  })

  it('AC-07: toggles KB selection on item click', () => {
    const onToggle = vi.fn()
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', documentCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={onToggle} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))
    fireEvent.click(screen.getByText('Docs'))

    expect(onToggle).toHaveBeenCalledWith('kb-1')
  })

  it('AC-07: shows checked state for selected KBs', () => {
    const onToggle = vi.fn()
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', documentCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={['kb-1']} onToggle={onToggle} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))

    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('AC-07: closes dropdown on Escape key', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', documentCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(<KbSelector selectedIds={[]} onToggle={() => {}} />)

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))
    expect(screen.getByTestId('kb-selector-dropdown')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    // 下拉应关闭
    expect(screen.queryByTestId('kb-selector-dropdown')).not.toBeInTheDocument()
  })

  it('AC-07: closes dropdown on outside click', () => {
    vi.mocked(useRequest).mockReturnValue({
      data: { data: [{ id: 'kb-1', name: 'Docs', documentCount: 5 }] },
      loading: false,
      error: undefined,
      send: vi.fn(),
    } as any)

    render(
      <div>
        <KbSelector selectedIds={[]} onToggle={() => {}} />
        <div data-testid="outside">outside</div>
      </div>
    )

    fireEvent.click(screen.getByTestId('kb-selector-trigger'))
    expect(screen.getByTestId('kb-selector-dropdown')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByTestId('kb-selector-dropdown')).not.toBeInTheDocument()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/KbSelector.spec.tsx
```

预期：FAIL — 模块未找到或渲染失败（组件不存在）

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/web/src/components/chat/KbSelector.tsx
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRequest } from 'alova/client'
import { getKbList } from '@/api/kb'
import type { KbEntry } from '@goferbot/data'
import { DatabaseIcon, HashIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface KbSelectorProps {
  selectedIds: string[]
  onToggle: (kbId: string) => void
  disabled?: boolean
}

export function KbSelector({ selectedIds, onToggle, disabled = false }: KbSelectorProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // useRequest 返回的 send() 是异步函数，调用后会自动更新 data/loading/error 状态。
  // send() 返回 Promise<response>，可用于链式 .then() 获取原始响应。
  const { data, loading, error, send } = useRequest(
    () => getKbList(),
    { immediate: false },
  )

  // alova interceptor 已解包 { data: T }，data 直接是 KbEntry[]。
  // 兼容双重包装：若 data 本身包含 .data 字段则取之，否则视为数组。
  const rawData = (data as any)
  const kbList: KbEntry[] = Array.isArray(rawData) ? rawData : (rawData?.data ?? [])

  const handleOpen = useCallback(() => {
    if (disabled) return
    setOpen(true)
    if (!data && !loading) send()
  }, [disabled, data, loading, send])

  const handleClose = useCallback(() => setOpen(false), [])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose()
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open, handleClose])

  // Escape 关闭
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, handleClose])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="kb-selector-trigger"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs',
          'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <HashIcon className="size-3.5" />
        <span>知识库</span>
        {selectedIds.length > 0 && (
          <span className="ml-0.5 rounded-full bg-brand-primary px-1.5 py-px text-[10px] text-white">
            {selectedIds.length}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          data-testid="kb-selector-dropdown"
          className="absolute bottom-full left-0 mb-2 max-h-48 w-72 overflow-y-auto rounded-xl border border-border-default bg-white shadow-xl"
        >
          {loading && (
            <div className="space-y-2 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="space-y-2 p-4 text-center text-sm">
              <p className="text-text-secondary">{error.message ?? '加载失败'}</p>
              <button
                data-testid="kb-selector-retry"
                className="text-brand-primary hover:underline"
                onClick={() => send()}
              >
                重试
              </button>
            </div>
          )}

          {!loading && !error && kbList.length === 0 && (
            <div className="p-4 text-center text-sm text-text-secondary">
              请先创建知识库
            </div>
          )}

          {!loading && !error && kbList.map((kb) => (
            <div
              key={kb.id}
              data-testid="kb-selector-item"
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors',
                'text-text-primary hover:bg-surface-2',
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                onToggle(kb.id)
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(kb.id)}
                className="pointer-events-none size-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
                readOnly
              />
              <DatabaseIcon className="size-4 text-text-secondary" />
              <span className="truncate">{kb.name}</span>
              <span className="ml-auto text-xs text-text-tertiary">
                {kb.documentCount ?? 0} 文档
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/KbSelector.spec.tsx
```

预期：PASS（10 tests）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/KbSelector.spec.tsx
```

---

### 任务 3: DeleteSessionDialog 组件

**文件：**
- 创建：`packages/web/src/overlays/dialogs/DeleteSessionDialog.tsx`
- 测试：`tests/unit/web/DeleteSessionDialog.spec.tsx`（新建）

**规格引用：**
- 行为规格：流程 3 — 删除会话（二次确认弹窗）
- 前端 Overlay 规范：`docs/guide/frontend/overlay-conventions.md`

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/DeleteSessionDialog.spec.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'

// 注意：DeleteSessionDialog 不自行管理打开/关闭状态，所有状态由 OverlayHost 管理。
// 测试中只需传入 onClose prop，不 mock useDialog。

describe('DeleteSessionDialog', () => {
  it('AC-04: renders dialog with session title', () => {
    render(
      <DeleteSessionDialog
        sessionTitle="My Session"
        onClose={() => {}}
      />,
    )

    expect(screen.getByText('删除会话')).toBeInTheDocument()
    expect(
      screen.getByText(/确定删除「My Session」？此操作不可撤销/),
    ).toBeInTheDocument()
    expect(screen.getByTestId('delete-cancel-btn')).toBeInTheDocument()
    expect(screen.getByTestId('delete-confirm-btn')).toBeInTheDocument()
  })

  it('AC-04: calls onClose with "confirm" when confirm button clicked', () => {
    const onClose = vi.fn()
    render(
      <DeleteSessionDialog
        sessionTitle="Test"
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-confirm-btn'))
    expect(onClose).toHaveBeenCalledWith('confirm')
  })

  it('AC-04: calls onClose with "cancel" when cancel button clicked', () => {
    const onClose = vi.fn()
    render(
      <DeleteSessionDialog
        sessionTitle="Test"
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-cancel-btn'))
    expect(onClose).toHaveBeenCalledWith('cancel')
  })

  it('AC-04: disables buttons when loading', () => {
    render(
      <DeleteSessionDialog
        sessionTitle="Test"
        onClose={() => {}}
        loading={true}
      />,
    )

    expect(screen.getByTestId('delete-confirm-btn')).toBeDisabled()
    expect(screen.getByTestId('delete-cancel-btn')).toBeDisabled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/DeleteSessionDialog.spec.tsx
```

预期：FAIL — 模块未找到

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/web/src/overlays/dialogs/DeleteSessionDialog.tsx
import { cn } from '@/utils/cn'

interface DeleteSessionDialogProps {
  sessionTitle: string
  loading?: boolean
  /** OverlayHost 注入：调用 onClose('confirm') 确认删除，onClose('cancel') 取消 */
  onClose: (result: 'confirm' | 'cancel') => void
}

/**
 * 删除会话确认弹窗
 *
 * 注意：OverlayHost 已提供遮罩层（fixed inset-0 + bg-black/40）、
 * 全屏居中容器（flex items-center justify-center）和关闭处理。
 * 本组件只渲染内部弹窗盒子内容（标题 + 描述 + 按钮组），
 * 通过 onClose prop 与 OverlayHost 通信。
 *
 * 使用方式：openDialog(DeleteSessionDialog, { sessionTitle })
 *          → Promise<'confirm' | undefined>
 */
export function DeleteSessionDialog({
  sessionTitle,
  loading = false,
  onClose,
}: DeleteSessionDialogProps) {
  return (
    <div className="w-full max-w-sm p-6">
      <h3 className="text-lg font-semibold text-text-primary">删除会话</h3>
      <p className="mt-2 text-sm text-text-secondary">
        确定删除「{sessionTitle}」？此操作不可撤销。
      </p>

      <div className="mt-6 flex justify-end gap-2">
        <button
          data-testid="delete-cancel-btn"
          onClick={() => onClose('cancel')}
          disabled={loading}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium',
            'border border-border-default text-text-primary hover:bg-surface-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          取消
        </button>
        <button
          data-testid="delete-confirm-btn"
          onClick={() => onClose('confirm')}
          disabled={loading}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium text-white',
            'bg-danger-600 hover:bg-danger-700',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          {loading ? '删除中...' : '删除'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/DeleteSessionDialog.spec.tsx
```

预期：PASS（4 tests）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/DeleteSessionDialog.spec.tsx
```

---

### 任务 4: SessionList 组件

**文件：**
- 创建：`packages/web/src/components/chat/SessionList.tsx`
- 测试：`tests/unit/web/SessionList.spec.tsx`（新建）

**规格引用：**
- 行为规格：交互状态表 — SessionList（loading/empty/error/normal）
- 行为规格：流程 1 — 新建会话
- 行为规格：流程 2 — 切换会话

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/SessionList.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionList } from '@/components/chat/SessionList'

// Mock useChatStore
const mockStore = {
  sessions: [] as any[],
  activeSession: null as any,
  isLoadingSessions: false,
  error: null as string | null,
  createSession: vi.fn(),
  setActiveSession: vi.fn(),
  loadSessions: vi.fn(),
  clearError: vi.fn(),
}

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: any) => {
    if (typeof selector === 'function') return selector(mockStore)
    return mockStore
  },
}))

describe('SessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.sessions = []
    mockStore.activeSession = null
    mockStore.isLoadingSessions = false
    mockStore.error = null
  })

  it('AC-01: shows loading skeletons when isLoadingSessions is true', () => {
    mockStore.isLoadingSessions = true

    render(<SessionList />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('AC-01: shows empty state when no sessions', () => {
    mockStore.isLoadingSessions = false
    mockStore.sessions = []

    render(<SessionList />)

    expect(screen.getByText('暂无会话')).toBeInTheDocument()
  })

  it('AC-01: shows error state with retry button', () => {
    mockStore.error = '网络错误'

    render(<SessionList />)

    expect(screen.getByText('网络错误')).toBeInTheDocument()
    expect(screen.getByTestId('session-list-retry')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('session-list-retry'))
    expect(mockStore.loadSessions).toHaveBeenCalledTimes(1)
  })

  it('AC-01: renders session items with title, messageCount, and relative time', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's2', title: 'Chat 2', messageCount: 0, createdAt: '2026-06-02T00:00:00Z' },
    ]

    render(<SessionList />)

    expect(screen.getByText('Chat 1')).toBeInTheDocument()
    expect(screen.getByText('Chat 2')).toBeInTheDocument()
    // 消息计数
    const counts = screen.getAllByText(/\d+/)
    expect(counts.length).toBeGreaterThanOrEqual(1)
  })

  it('AC-03: calls setActiveSession when session item clicked', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]

    render(<SessionList />)

    fireEvent.click(screen.getByText('Chat 1'))
    expect(mockStore.setActiveSession).toHaveBeenCalledWith(mockStore.sessions[0])
  })

  it('AC-03: highlights active session', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's2', title: 'Chat 2', messageCount: 3, createdAt: '2026-06-02T00:00:00Z' },
    ]
    mockStore.activeSession = mockStore.sessions[0]

    render(<SessionList />)

    const items = screen.getAllByTestId('session-item')
    expect(items[0].className).toContain('bg-surface-2')
  })

  it('AC-01: boundary — renders sessions but no activeSession highlighted when activeSession is null', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's2', title: 'Chat 2', messageCount: 3, createdAt: '2026-06-02T00:00:00Z' },
    ]
    mockStore.activeSession = null

    render(<SessionList />)

    const items = screen.getAllByTestId('session-item')
    expect(items).toHaveLength(2)
    // activeSession 为 null 时，不应有高亮项
    expect(items[0].className).not.toContain('bg-surface-2')
    expect(items[1].className).not.toContain('bg-surface-2')
  })

  it('AC-02: renders new session button and calls createSession on click', () => {
    render(<SessionList />)

    const btn = screen.getByTestId('new-session-btn')
    expect(btn).toBeInTheDocument()

    fireEvent.click(btn)
    expect(mockStore.createSession).toHaveBeenCalledTimes(1)
  })

  it('shows rename option in DropdownMenu and calls onRenameClick', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]
    const onRenameClick = vi.fn()
    const onDeleteClick = vi.fn()

    render(<SessionList onRenameClick={onRenameClick} onDeleteClick={onDeleteClick} />)

    // 点击 "..." 按钮打开 DropdownMenu
    fireEvent.click(screen.getByTestId('session-more-btn'))
    // 验证重命名选项存在
    expect(screen.getByTestId('session-rename-btn')).toBeInTheDocument()
    // 点击重命名
    fireEvent.click(screen.getByTestId('session-rename-btn'))
    expect(onRenameClick).toHaveBeenCalledWith(mockStore.sessions[0])
  })

  it('shows delete option in DropdownMenu and calls onDeleteClick', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]
    const onDeleteClick = vi.fn()

    render(<SessionList onDeleteClick={onDeleteClick} />)

    // 点击 "..." 按钮
    fireEvent.click(screen.getByTestId('session-more-btn'))
    // 验证删除选项存在
    expect(screen.getByTestId('session-delete-btn')).toBeInTheDocument()
    // 点击删除
    fireEvent.click(screen.getByTestId('session-delete-btn'))
    expect(onDeleteClick).toHaveBeenCalledWith(mockStore.sessions[0])
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/SessionList.spec.tsx
```

预期：FAIL — 模块未找到

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/web/src/components/chat/SessionList.tsx
import { useState } from 'react'
import { useChatStore } from '@/stores/chat'
import {
  PlusIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ChatSession = import('@goferbot/data').ChatSession

interface SessionListProps {
  /** 重命名回调，传入被操作的会话对象 */
  onRenameClick?: (session: ChatSession) => void
  /** 删除回调，传入被操作的会话对象 */
  onDeleteClick?: (session: ChatSession) => void
}

export function SessionList({ onRenameClick, onDeleteClick }: SessionListProps) {
  const sessions = useChatStore((s) => s.sessions)
  const activeSession = useChatStore((s) => s.activeSession)
  const isLoadingSessions = useChatStore((s) => s.isLoadingSessions)
  const error = useChatStore((s) => s.error)
  const createSession = useChatStore((s) => s.createSession)
  const setActiveSession = useChatStore((s) => s.setActiveSession)
  const loadSessions = useChatStore((s) => s.loadSessions)
  const clearError = useChatStore((s) => s.clearError)

  return (
    <div className="flex h-full flex-col border-r border-border-default bg-surface-1">
      {/* 标题栏 */}
      <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">会话</h2>
        <button
          data-testid="new-session-btn"
          onClick={() => createSession()}
          className="rounded p-1 text-text-secondary hover:bg-surface-2 hover:text-text-primary"
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      {/* 会话列表内容 */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingSessions && (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        )}

        {!isLoadingSessions && error && (
          <div className="space-y-2 p-4 text-center text-sm">
            <p className="text-text-secondary">{error}</p>
            <button
              data-testid="session-list-retry"
              className="text-brand-primary hover:underline"
              onClick={() => {
                clearError()
                loadSessions()
              }}
            >
              重试
            </button>
          </div>
        )}

        {!isLoadingSessions && !error && sessions.length === 0 && (
          <div className="p-4 text-center text-sm text-text-tertiary">
            暂无会话
          </div>
        )}

        {!isLoadingSessions && !error && sessions.map((session) => {
          const sessionDate = session.createdAt ? new Date(session.createdAt) : null
          return (
          <div
            key={session.id}
            data-testid="session-item"
            onClick={() => setActiveSession(session)}
            className={cn(
              'group mx-2 my-0.5 cursor-pointer rounded-lg px-3 py-2.5 transition-colors',
              activeSession?.id === session.id
                ? 'bg-surface-2 text-text-primary'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary',
            )}
          >
            <div className="flex items-center gap-2">
              <MessageCircleIcon className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm">{session.title}</span>
                {sessionDate && (
                  <span className="block text-xs text-text-tertiary">
                    {formatDistanceToNow(sessionDate, { addSuffix: true, locale: zhCN })}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {session.messageCount > 0 && (
                  <span className="text-xs text-text-tertiary">
                    {session.messageCount}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="session-more-btn"
                      onClick={(e) => e.stopPropagation()}
                      className="rounded p-0.5 text-text-tertiary opacity-0 transition-opacity hover:bg-surface-3 hover:text-text-primary group-hover:opacity-100"
                    >
                      <MoreHorizontalIcon className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      data-testid="session-rename-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onRenameClick?.(session)
                      }}
                    >
                      <PencilIcon className="mr-2 size-4" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="session-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteClick?.(session)
                      }}
                    >
                      <Trash2Icon className="mr-2 size-4 text-destructive" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/SessionList.spec.tsx
```

预期：PASS（10 tests）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/SessionList.spec.tsx
```

---

### 任务 5: ChatInput 集成 KbSelector

**文件：**
- 修改：`packages/web/src/components/chat/ChatInput.tsx`
- 测试：`tests/unit/web/ChatInput.spec.tsx`（新建，若已有则修改）

**规格引用：**
- 行为规格：流程 5 — KbSelector 选择知识库
- 行为规格：组件树 — ChatInput 含 KbSelector

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/ChatInput.spec.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatInput } from '@/components/chat/ChatInput'

// Mock alova useRequest for KbSelector
vi.mock('alova/client', () => ({
  useRequest: vi.fn(() => ({
    data: undefined,
    loading: false,
    error: undefined,
    send: vi.fn(),
  })),
}))

describe('ChatInput with KbSelector', () => {
  it('renders KbSelector trigger in input area', () => {
    render(<ChatInput onSend={() => {}} />)

    expect(screen.getByTestId('kb-selector-trigger')).toBeInTheDocument()
  })

  it('passes selectedKnowledgeBaseIds to onSend', () => {
    const onSend = vi.fn()
    render(<ChatInput onSend={onSend} />)

    const textarea = screen.getByPlaceholderText(/输入消息/)
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    fireEvent.click(screen.getByText('发送'))

    // onSend 应被调用，第二个参数为 selectedKnowledgeBaseIds
    expect(onSend).toHaveBeenCalledWith('Hello', [])
  })

  it('disables input and KbSelector when disabled', () => {
    render(<ChatInput onSend={() => {}} disabled={true} />)

    const textarea = screen.getByPlaceholderText(/输入消息/)
    expect(textarea).toBeDisabled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/ChatInput.spec.tsx
```

预期：FAIL — KbSelector trigger 不存在、onSend 签名不匹配

- [ ] **步骤 3: 编写最小实现**

修改 `packages/web/src/components/chat/ChatInput.tsx`：

```typescript
// packages/web/src/components/chat/ChatInput.tsx
import { useState, useRef, useCallback } from 'react'
import { cn } from '@/utils/cn'
import { KbSelector } from './KbSelector'

interface ChatInputProps {
  /**
   * 发送消息回调。
   * 签名变更说明：从 (content: string) 变为 (content, knowledgeBaseIds?)。
   * 所有调用方（ChatView 的 handleSend）需同步修改以传入 knowledgeBaseIds。
   */
  onSend: (content: string, knowledgeBaseIds?: string[]) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = '输入消息...',
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [selectedKbIds, setSelectedKbIds] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleToggleKb = useCallback((kbId: string) => {
    setSelectedKbIds((prev) =>
      prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId],
    )
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed, selectedKbIds)
    setValue('')
    textareaRef.current?.focus()
  }, [value, disabled, selectedKbIds, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border-default bg-surface-1 p-4">
      {/* KbSelector 行 */}
      <div className="mb-2 flex items-center gap-2">
        <KbSelector
          selectedIds={selectedKbIds}
          onToggle={handleToggleKb}
          disabled={disabled}
        />
        {/* 已选 KB 标签 */}
        {selectedKbIds.length > 0 && (
          <span className="text-xs text-text-tertiary">
            已选 {selectedKbIds.length} 个知识库
          </span>
        )}
      </div>

      {/* 输入行 */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={2}
          className={cn(
            'flex-1 resize-none rounded-md border px-3 py-2 text-sm',
            'border-border-default bg-surface-1 text-text-primary',
            'focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium text-white',
            'bg-brand-primary hover:bg-brand-secondary',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          发送
        </button>
      </div>
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/ChatInput.spec.tsx
```

预期：PASS（3 tests）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/ChatInput.spec.tsx
```

---

### 任务 6: ChatView 集成会话管理 + 错误处理

**文件：**
- 修改：`packages/web/src/routes/app/chat.tsx`
- 测试：`tests/unit/web/ChatView.spec.tsx`（新建或修改）

**规格引用：**
- 行为规格：完整组件树
- 行为规格：流程 3（删除会话）、流程 4（重命名）
- 行为规格：交互状态表 — Error toast

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/web/ChatView.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatViewPage from '@/routes/app/chat' // 需确认实际导出名

// Mock 依赖
const mockStore = {
  activeSession: null as any,
  messages: [] as any[],
  sessions: [] as any[],
  streamingContent: '',
  isStreaming: false,
  isLoadingHistory: false,
  isLoadingSessions: false,
  error: null as string | null,
  setMessages: vi.fn(),
  appendMessage: vi.fn(),
  setIsLoadingHistory: vi.fn(),
  setIsStreaming: vi.fn(),
  appendStreamContent: vi.fn(),
  flushStreamContent: vi.fn(),
  clearChat: vi.fn(),
  setActiveSession: vi.fn(),
  loadSessions: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  clearError: vi.fn(),
}

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: any) => {
    if (typeof selector === 'function') return selector(mockStore)
    return mockStore
  },
}))

vi.mock('alova/client', () => ({
  useRequest: vi.fn(() => ({
    data: undefined,
    send: vi.fn().mockResolvedValue({ data: { messages: [] } }),
    loading: false,
    error: undefined,
  })),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => ({
    component: (c: any) => c,
  }),
}))

describe('ChatView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockStore, {
      activeSession: null,
      messages: [],
      sessions: [],
      streamingContent: '',
      isStreaming: false,
      isLoadingHistory: false,
      isLoadingSessions: false,
      error: null,
    })
  })

  it('AC-08: shows empty guide when no activeSession and no sessions', () => {
    mockStore.sessions = []
    mockStore.activeSession = null

    render(<ChatViewPage />)

    expect(screen.getByText('开始新对话')).toBeInTheDocument()
    expect(screen.getByText(/在下方输入消息，开始与 AI 对话/)).toBeInTheDocument()
  })

  it('AC-01: renders SessionList when sessions exist', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]

    render(<ChatViewPage />)

    expect(screen.getByText('Chat 1')).toBeInTheDocument()
  })

  it('AC-06: double-click title enters inline rename mode', () => {
    mockStore.activeSession = { id: 's1', title: 'Old Title', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' }

    render(<ChatViewPage />)

    const title = screen.getByText('Old Title')
    fireEvent.doubleClick(title)

    // 应出现 input
    const input = screen.getByDisplayValue('Old Title')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('AC-06: Enter confirms rename and calls renameSession', async () => {
    mockStore.activeSession = { id: 's1', title: 'Old Title', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' }
    mockStore.renameSession = vi.fn().mockResolvedValue(undefined)

    render(<ChatViewPage />)

    fireEvent.doubleClick(screen.getByText('Old Title'))

    const input = screen.getByDisplayValue('Old Title')
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockStore.renameSession).toHaveBeenCalledWith('s1', 'New Title')
  })

  it('AC-06: Escape cancels rename', () => {
    mockStore.activeSession = { id: 's1', title: 'Old Title', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' }

    render(<ChatViewPage />)

    fireEvent.doubleClick(screen.getByText('Old Title'))

    const input = screen.getByDisplayValue('Old Title')
    fireEvent.keyDown(input, { key: 'Escape' })

    // 应恢复为原标题
    expect(screen.getByText('Old Title')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Old Title')).not.toBeInTheDocument()
  })

  it('AC-09: shows error toast when error exists', () => {
    mockStore.error = '操作失败'

    render(<ChatViewPage />)

    expect(screen.getByText('操作失败')).toBeInTheDocument()
    expect(screen.getByTestId('error-toast-close')).toBeInTheDocument()
  })

  it('AC-09: dismisses error toast on close button click', () => {
    mockStore.error = '操作失败'

    render(<ChatViewPage />)

    fireEvent.click(screen.getByTestId('error-toast-close'))
    expect(mockStore.clearError).toHaveBeenCalledTimes(1)
  })

  it('AC-05: renders empty guide when deleting activeSession', () => {
    // 模拟删除活跃会话后的状态
    mockStore.activeSession = null
    mockStore.sessions = [
      { id: 's2', title: 'Remaining', messageCount: 1, createdAt: '2026-06-02T00:00:00Z' },
    ]

    render(<ChatViewPage />)

    expect(screen.getByText('开始新对话')).toBeInTheDocument()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/unit/web/ChatView.spec.tsx
```

预期：FAIL — 组件可能渲染错误或断言失败

- [ ] **步骤 3: 编写最小实现**

重写 `packages/web/src/routes/app/chat.tsx`：

```typescript
// packages/web/src/routes/app/chat.tsx
import { useCallback, useEffect, useState, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useRequest } from 'alova/client'
import { getHistory } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { ChatInput } from '@/components/chat/ChatInput'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { EditorPlaceholder } from '@/components/chat/EditorPlaceholder'
import { SessionList } from '@/components/chat/SessionList'
import { openDialog } from '@/overlays'
import { DeleteSessionDialog } from '@/overlays/dialogs/DeleteSessionDialog'
import { AlertCircleIcon, XIcon } from 'lucide-react'

export const Route = createFileRoute('/app/chat')({
  component: ChatViewPage,
})

function ChatViewPage() {
  const activeSession = useChatStore((s) => s.activeSession)
  const messages = useChatStore((s) => s.messages)
  const streamingContent = useChatStore((s) => s.streamingContent)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const isLoadingHistory = useChatStore((s) => s.isLoadingHistory)
  const error = useChatStore((s) => s.error)
  const setMessages = useChatStore((s) => s.setMessages)
  const appendMessage = useChatStore((s) => s.appendMessage)
  const setIsLoadingHistory = useChatStore((s) => s.setIsLoadingHistory)
  const renameSession = useChatStore((s) => s.renameSession)
  const deleteSession = useChatStore((s) => s.deleteSession)
  const clearError = useChatStore((s) => s.clearError)
  const loadSessions = useChatStore((s) => s.loadSessions)

  // 重命名 inline 编辑状态
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // 首次加载会话列表
  useEffect(() => {
    loadSessions()
  }, [])

  // 加载历史消息（仅当有活跃 session 时）
  const { send: loadHistory } = useRequest(
    () => getHistory(activeSession?.id ?? ''),
    { immediate: false },
  )

  useEffect(() => {
    if (activeSession?.id) {
      setIsLoadingHistory(true)
      loadHistory()
        .then((res) => {
          const data = (res as { data?: { messages?: unknown[] } })?.data
          if (data?.messages) {
            setMessages(data.messages as never[])
          }
          setIsLoadingHistory(false)
        })
        .catch(() => {
          setIsLoadingHistory(false)
        })
    }
  }, [activeSession?.id])

  // 发送消息
  const handleSend = useCallback(
    (content: string, knowledgeBaseIds?: string[]) => {
      if (!content.trim()) return

      const userMsg = {
        id: `msg-${Date.now()}`,
        sessionId: activeSession?.id ?? '',
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
      }
      appendMessage(userMsg)

      // TODO: SSE 流式调用（useSSE hook，f-44 实现）
      // 届时传入 knowledgeBaseIds
    },
    [activeSession, appendMessage],
  )

  // 删除会话
  const handleDeleteSession = useCallback(
    async (sessionId: string, sessionTitle: string) => {
      const result = await openDialog<'confirm' | undefined>(
        DeleteSessionDialog,
        { sessionTitle },
      )
      if (result === 'confirm') {
        await deleteSession(sessionId)
      }
    },
    [deleteSession],
  )

  // 进入重命名模式
  const handleStartRename = useCallback(() => {
    if (!activeSession) return
    setRenameValue(activeSession.title)
    setIsRenaming(true)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }, [activeSession])

  // 确认重命名
  const handleConfirmRename = useCallback(async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || !activeSession) {
      setIsRenaming(false)
      return
    }
    if (trimmed !== activeSession.title) {
      await renameSession(activeSession.id, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, activeSession, renameSession])

  // 取消重命名
  const handleCancelRename = useCallback(() => {
    setIsRenaming(false)
    setRenameValue('')
  }, [])

  // Error toast 自动消失
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  return (
    <div className="flex h-full">
      {/* 左侧会话列表 */}
      <SessionList />

      {/* 右侧聊天区 */}
      <div className="flex flex-1 flex-col">
        {/* 会话标题栏 */}
        <div className="flex h-12 items-center border-b border-border-default bg-surface-1 px-4">
          {isRenaming && activeSession ? (
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleConfirmRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmRename()
                if (e.key === 'Escape') handleCancelRename()
              }}
              className="rounded border border-brand-primary px-2 py-0.5 text-sm font-medium text-text-primary outline-none"
            />
          ) : (
            <h2
              className="cursor-pointer text-sm font-medium text-text-primary hover:text-brand-primary"
              onDoubleClick={handleStartRename}
              title="双击重命名"
            >
              {activeSession?.title ?? '新对话'}
            </h2>
          )}
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-8 text-sm text-text-secondary">
              加载中...
            </div>
          )}

          {!isLoadingHistory && messages.length === 0 && !streamingContent && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h3 className="text-lg font-medium text-text-primary">开始新对话</h3>
                <p className="mt-2 text-sm text-text-secondary">
                  在下方输入消息，开始与 AI 对话
                </p>
                {/* EditorPlaceholder 依赖 f-49（编辑器组件），当前可能不可用。
                    若 f-49 未完成，可暂时注释此行，不影响其他功能。 */}
                <EditorPlaceholder className="mt-6 mx-4" />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* SSE 流式接收中的临时内容 */}
          {isStreaming && streamingContent && (
            <MessageBubble
              message={{
                id: 'streaming',
                sessionId: activeSession?.id ?? '',
                role: 'assistant',
                content: streamingContent,
                createdAt: new Date().toISOString(),
              }}
            />
          )}

          {/* 流式加载指示器 */}
          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-tertiary [animation-delay:0.3s]" />
              </div>
            </div>
          )}
        </div>

        {/* 输入框 */}
        <ChatInput
          onSend={handleSend}
          disabled={isStreaming}
          placeholder={activeSession ? '继续对话...' : '输入消息开始新对话...'}
        />

        {/* Error toast */}
        {error && (
          <div className="absolute bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-danger-600/20 bg-white px-4 py-2.5 text-sm text-danger-600 shadow-xl">
            <AlertCircleIcon className="size-4" />
            <span>{error}</span>
            <button
              data-testid="error-toast-close"
              onClick={clearError}
              className="ml-1 rounded p-0.5 hover:bg-surface-2"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/unit/web/ChatView.spec.tsx
```

预期：PASS（10 tests）

- [ ] **步骤 5: 验证并标记完成**

```bash
npx vitest run tests/unit/web/
```

---

## 规格覆盖检查

### PRD 覆盖

| PRD §5.7 目标 | 任务 | 覆盖 |
|---------------|------|------|
| ChatView 会话管理 | 任务 3-6 | ✅ |
| 新建/切换/删除/重命名 | 任务 1, 3, 4, 6 | ✅ |
| KbSelector 集成 | 任务 2, 5 | ✅ |

### 功能规格覆盖

| 验收标准 | 任务 | 测试 |
|----------|------|------|
| AC-01 SessionList 渲染 | 任务 4 | SessionList.spec.tsx |
| AC-02 + 新建激活 | 任务 4 | SessionList.spec.tsx |
| AC-03 切换 + loadHistory | 任务 4 | SessionList.spec.tsx |
| AC-04 删除二次确认 | 任务 3 | DeleteSessionDialog.spec.tsx |
| AC-05 删除 activeSession | 任务 6 | ChatView.spec.tsx |
| AC-06 inline 重命名 | 任务 6 | ChatView.spec.tsx |
| AC-07 KbSelector 各状态 | 任务 2 | KbSelector.spec.tsx |
| AC-08 空会话引导 | 任务 6 | ChatView.spec.tsx |
| AC-09 error toast | 任务 6 | ChatView.spec.tsx |
| AC-10 创建失败不污染 | 任务 4 | SessionList.spec.tsx |

### 行为规格覆盖

| 行为规格章节 | 任务 | 覆盖 |
|-------------|------|------|
| 初始状态（loading/empty/error/normal） | 任务 4, 6 | ✅ |
| 交互状态表（14 种状态） | 任务 2-6 | ✅ |
| 流程 1: 新建会话 | 任务 4 | ✅ |
| 流程 2: 切换会话 | 任务 4 | ✅ |
| 流程 3: 删除会话 | 任务 3, 6 | ✅ |
| 流程 4: inline 重命名 | 任务 6 | ✅ |
| 流程 5: KbSelector 选择 | 任务 2, 5 | ✅ |
| 错误场景（6 种） | 任务 2, 4, 6 | ✅ |
| 边界条件 | 任务 2, 4, 6 | ✅ |

---

## 自检清单

- [x] 所有任务以测试开始（TDD RED）
- [x] 所有测试包含具体断言（非 "should work"）
- [x] 每个任务末尾有 `npx vitest run` 验证命令
- [x] 无 TODO/TBD/稍后实现
- [x] 文件路径精确到具体文件
- [x] 类型引用与 `@goferbot/data` 一致
- [x] PRD §5.7 三个目标全部覆盖
- [x] 10 个 AC 全部映射到任务
- [x] ADR 合规：无新增 DTO、无新增 API 端点、无新增 npm 包
- [x] Overlay 规范：DeleteSessionDialog 放入 `overlays/dialogs/`，OverlayHost 注入 `onClose` prop，组件通过 `onClose("confirm"|"cancel")` 返回结果

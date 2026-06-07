import { createPortal } from 'react-dom'
import { useOverlayStore } from './overlay-store'
import { cn } from '@/utils/cn'

export function OverlayHost() {
  const entries = useOverlayStore((s) => s.entries)
  const remove = useOverlayStore((s) => s.remove)

  if (entries.length === 0) return null

  return createPortal(
    <>
      {entries.map((entry) => {
        const { id, component: Comp, props, zIndex, kind, position } = entry

        if (kind === 'dialog') {
          return (
            <div
              key={id}
              className="fixed inset-0 flex items-center justify-center"
              style={{ zIndex }}
            >
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/40"
                onClick={() => remove(id)}
              />
              {/* Dialog content */}
              <div className="relative rounded-lg bg-surface-1 shadow-lg">
                <Comp {...props} onClose={(result?: unknown) => remove(id, result)} />
              </div>
            </div>
          )
        }

        if (kind === 'context-menu') {
          return (
            <div
              key={id}
              className="fixed"
              style={{
                zIndex,
                left: position?.x ?? 0,
                top: position?.y ?? 0,
              }}
            >
              <div
                className={cn(
                  'rounded-md border border-border-default bg-surface-1 py-1 shadow-lg',
                  'min-w-[160px]',
                )}
              >
                <Comp
                  {...props}
                  onClose={(result?: unknown) => remove(id, result)}
                />
              </div>
              {/* Click-away to close */}
              <div
                className="fixed inset-0"
                style={{ zIndex: -1 }}
                onClick={() => remove(id)}
              />
            </div>
          )
        }

        return null
      })}
    </>,
    document.body,
  )
}

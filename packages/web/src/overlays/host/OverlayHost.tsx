import { createPortal } from 'react-dom'
import { useOverlayStore } from './overlay-store'

export function OverlayHost() {
  const entries = useOverlayStore((s) => s.entries)
  const remove = useOverlayStore((s) => s.remove)

  if (entries.length === 0) return null

  return createPortal(
    entries.map((entry) => {
      const { id, component: Comp, props } = entry
      return <Comp key={id} {...props} onClose={(result?: unknown) => remove(id, result)} />
    }),
    document.body,
  )
}

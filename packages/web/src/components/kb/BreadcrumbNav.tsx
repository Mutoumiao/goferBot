import { Home, ChevronRight } from 'lucide-react'
import type { Folder } from '@/stores/file'

interface BreadcrumbNavProps {
  items: Folder[]
  currentKbName: string
  onNavigate: (folderId: string | null) => void
}

export function BreadcrumbNav({ items, currentKbName, onNavigate }: BreadcrumbNavProps) {
  const isLast = (index: number) => index === items.length - 1

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="目录导航">
      <button
        type="button"
        data-testid="breadcrumb-root"
        className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        onClick={() => onNavigate(null)}
        aria-label="返回根目录"
      >
        <Home className="h-4 w-4" />
        <span>{currentKbName}</span>
      </button>

      {items.map((folder, index) => (
        <span key={folder.id} className="flex items-center gap-1">
          <ChevronRight data-testid="breadcrumb-separator" className="h-3 w-3 text-text-tertiary" />
          {isLast(index) ? (
            <span className="text-text-primary font-medium" aria-current="page">
              {folder.name}
            </span>
          ) : (
            <button
              type="button"
              className="text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => onNavigate(folder.id)}
            >
              {folder.name}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}

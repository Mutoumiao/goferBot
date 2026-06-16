import { useState, useCallback } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, LayoutGrid, List, ArrowUpDown, Upload } from 'lucide-react'
import type { Folder } from '../types'
import type { ViewMode, SortOption } from '../types'

interface KnowledgeBaseToolbarProps {
  kbName: string
  breadcrumb: Folder[]
  onNavigate: (folderId: string | null) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  sortOption: SortOption
  onSortChange: (option: SortOption) => void
  onUpload?: () => void
  searchQuery?: string
  onSearchChange?: (query: string) => void
}

export function KnowledgeBaseToolbar({
  kbName,
  breadcrumb,
  onNavigate,
  viewMode,
  onViewModeChange,
  sortOption,
  onSortChange,
  onUpload,
  searchQuery = '',
  onSearchChange,
}: KnowledgeBaseToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setSearchOpen(true)
    }
  }, [])

  return (
    <div className="flex items-center justify-between border-b border-[#E7EAF0] px-5 py-2.5" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => onNavigate(null)}
                className="cursor-pointer text-[#5E6673] hover:text-[#1F2328]"
              >
                {kbName}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumb.map((folder, index) => (
              <div key={folder.id} className="flex items-center">
                <BreadcrumbSeparator className="text-[#9AA3AF]" />
                <BreadcrumbItem>
                  {index === breadcrumb.length - 1 ? (
                    <BreadcrumbPage className="text-[#1F2328]">{folder.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => onNavigate(folder.id)}
                      className="cursor-pointer text-[#5E6673] hover:text-[#1F2328]"
                    >
                      {folder.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-1.5">
        {searchOpen ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-[#F4F5F7] px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-[#9AA3AF]" />
            <Input
              type="text"
              placeholder="搜索当前知识库..."
              className="h-auto w-44 border-0 bg-transparent p-0 text-sm text-[#1F2328] shadow-none placeholder:text-[#9AA3AF] focus-visible:ring-0"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onBlur={() => {
                if (!searchQuery) setSearchOpen(false)
              }}
            />
            <Kbd>⌘K</Kbd>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg bg-[#F4F5F7] text-[#5E6673] hover:bg-[#EBECF0]"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg bg-[#F4F5F7] text-[#5E6673] hover:bg-[#EBECF0]"
          onClick={() => onViewModeChange(viewMode === 'grid' ? 'list' : 'grid')}
        >
          {viewMode === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg bg-[#F4F5F7] text-[#5E6673] hover:bg-[#EBECF0]"
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={sortOption} onValueChange={(v) => onSortChange(v as SortOption)}>
              <DropdownMenuRadioItem value="updatedAt-desc">按更新时间（新→旧）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="updatedAt-asc">按更新时间（旧→新）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="createdAt-desc">按创建时间（新→旧）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="createdAt-asc">按创建时间（旧→新）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name-asc">按名称（A→Z）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name-desc">按名称（Z→A）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size-desc">按大小（大→小）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="size-asc">按大小（小→大）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="type-asc">按类型（A→Z）</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="type-desc">按类型（Z→A）</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg bg-[#F4F5F7] text-[#5E6673] hover:bg-[#EBECF0]"
          onClick={onUpload}
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

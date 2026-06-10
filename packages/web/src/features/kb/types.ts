export interface Folder {
  id: string
  kbId: string
  parentId: string | null
  name: string
  createdAt: string
  updatedAt: string
}

export interface DocumentItem {
  id: string
  kbId: string
  folderId: string | null
  name: string
  ext: string | null
  mimeType: string | null
  size: number | null
  status: 'uploaded' | 'parsing' | 'chunking' | 'indexing' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
}

export interface UploadTask {
  id: string
  fileName: string
  fileSize: number
  progress: number
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  error?: string
  kbId: string
  folderId?: string | null
  file?: File
}

export type ViewMode = 'grid' | 'list'

export type SortOption = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc'

export type FilterType = 'all' | 'document' | 'image' | 'other'

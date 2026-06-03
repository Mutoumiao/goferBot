export interface Paginator {
  total: number
  size: number
  currentPage: number
  totalPage: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginationResult<T> {
  data: T[]
  pagination: Paginator
}

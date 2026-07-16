import { alovaInstance } from '@/utils/server'

export type CompanionStatus = 'draft' | 'published' | 'archived'

export interface AdminCompanion {
  id: string
  source: 'system' | 'user'
  name: string
  headline?: string | null
  description?: string | null
  personality?: string | null
  tone?: string | null
  boundaries?: string | null
  guardrailsPrompt?: string | null
  defaultPrompt?: string | null
  avatarKey?: string | null
  avatarUrl?: string | null
  backgroundStory?: string | null
  openingMessage?: string | null
  visibility?: string | null
  status: CompanionStatus
  createdAt: string
  updatedAt: string
}

export interface AdminCompanionListResponse {
  items: AdminCompanion[]
  pagination: {
    total: number
    size: number
    totalPage: number
    currentPage: number
  }
}

export type CreateAdminCompanionPayload = {
  name: string
  headline?: string
  description?: string
  personality?: string
  tone?: string
  boundaries?: string
  guardrailsPrompt?: string
  backgroundStory?: string
  openingMessage?: string
  avatarKey?: string
  visibility?: string
  status?: CompanionStatus
}

export type UpdateAdminCompanionPayload = Partial<CreateAdminCompanionPayload>

export function listAdminCompanions(params?: {
  status?: CompanionStatus
  page?: number
  size?: number
}) {
  return alovaInstance.Get<AdminCompanionListResponse>('/admin/companions', { params })
}

export function getAdminCompanion(id: string) {
  return alovaInstance.Get<AdminCompanion>(`/admin/companions/${id}`)
}

export function createAdminCompanion(payload: CreateAdminCompanionPayload) {
  return alovaInstance.Post<AdminCompanion>('/admin/companions', payload)
}

export function updateAdminCompanion(id: string, payload: UpdateAdminCompanionPayload) {
  return alovaInstance.Put<AdminCompanion>(`/admin/companions/${id}`, payload)
}

export function updateAdminCompanionStatus(id: string, status: CompanionStatus) {
  return alovaInstance.Patch<AdminCompanion>(`/admin/companions/${id}/status`, { status })
}

export function archiveAdminCompanion(id: string) {
  return alovaInstance.Delete<AdminCompanion>(`/admin/companions/${id}`)
}

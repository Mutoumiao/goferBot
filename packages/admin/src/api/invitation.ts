import { alovaInstance } from '@/utils/server'

export interface InvitationCode {
  id: string
  code: string
  type: 'standard' | 'multi'
  maxUses: number | null
  useCount: number
  note: string | null
  expiresAt: string | null
  isExpired: boolean
  isRevoked: boolean
  isActive: boolean
  createdAt: string
  createdBy: string
}

export interface InvitationQuery {
  page?: number
  pageSize?: number
  type?: 'standard' | 'multi'
  active?: boolean
}

export interface CreateInvitationRequest {
  type?: 'standard' | 'multi'
  maxUses?: number
  note?: string
  expiresAt?: string
}

export type PagedResponse<T> = { items: T[]; total: number; page: number; pageSize: number }

export const fetchInvitations = (query: InvitationQuery = {}) =>
  alovaInstance.Get<PagedResponse<InvitationCode>>('/admin/invitations', { params: query })

export const createInvitation = (data: CreateInvitationRequest) =>
  alovaInstance.Post<InvitationCode>('/admin/invitations', data)

export const revokeInvitation = (id: string) =>
  alovaInstance.Post<{ success: true }>(`/admin/invitations/${id}/revoke`)

export const deleteInvitation = (id: string) =>
  alovaInstance.Delete<{ success: true }>(`/admin/invitations/${id}`)

import { toast } from 'sonner'
import type {
  CreateInvitationRequest,
  InvitationCode,
  InvitationQuery,
  PagedResponse,
} from '@/api/invitation'
import {
  createInvitation as createInvitationApi,
  deleteInvitation as deleteInvitationApi,
  fetchInvitations as fetchInvitationsApi,
  revokeInvitation as revokeInvitationApi,
} from '@/api/invitation'
import { mapErrorMessage } from '@/utils/error-mapper'

export type { CreateInvitationRequest, InvitationCode, InvitationQuery, PagedResponse }

export async function fetchInvitations(
  query: InvitationQuery = {},
): Promise<PagedResponse<InvitationCode>> {
  try {
    return await fetchInvitationsApi(query).send()
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    throw err
  }
}

export async function createInvitationService(
  data: CreateInvitationRequest,
): Promise<{ success: boolean; data?: InvitationCode; error?: string }> {
  try {
    const result = await createInvitationApi(data).send()
    toast.success('邀请码创建成功')
    return { success: true, data: result }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function revokeInvitationService(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await revokeInvitationApi(id).send()
    toast.success('邀请码已撤销')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

export async function deleteInvitationService(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteInvitationApi(id).send()
    toast.success('邀请码已删除')
    return { success: true }
  } catch (err) {
    const msg = mapErrorMessage(err)
    toast.error(msg)
    return { success: false, error: msg }
  }
}

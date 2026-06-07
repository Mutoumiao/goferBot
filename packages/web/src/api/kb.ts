import type { CreateKbRequest } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export const getKbList = () =>
  alovaInstance.Get('/knowledge-base')

export const createKb = (data: CreateKbRequest) =>
  alovaInstance.Post('/knowledge-base', data)

export const deleteKb = (id: string) =>
  alovaInstance.Delete(`/knowledge-base/${id}`)

export const getKbDetail = (id: string) =>
  alovaInstance.Get(`/knowledge-base/${id}`)

export const uploadFile = (kbId: string, formData: FormData) =>
  alovaInstance.Post(`/knowledge-base/${kbId}/files`, formData)

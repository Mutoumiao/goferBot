import type { CreateKbRequest, UpdateKbRequest } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

export const getKbList = () =>
  alovaInstance.Get('/knowledge-bases')

export const createKb = (data: CreateKbRequest) =>
  alovaInstance.Post('/knowledge-bases', data)

export const updateKb = (id: string, data: UpdateKbRequest) =>
  alovaInstance.Patch(`/knowledge-bases/${id}`, data)

export const deleteKb = (id: string) =>
  alovaInstance.Delete(`/knowledge-bases/${id}`)

export const getKbDetail = (id: string) =>
  alovaInstance.Get(`/knowledge-bases/${id}`)

export const uploadFile = (kbId: string, formData: FormData) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/documents/upload`, formData)

export const searchKbItems = (kbId: string, query: string) =>
  alovaInstance.Get(`/knowledge-bases/${kbId}/search`, {
    params: { q: query },
  })

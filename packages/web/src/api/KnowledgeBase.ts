import type { CreateKbRequest, KbSelectorResponse, UpdateKbRequest } from '@goferbot/data'
import { alovaInstance } from '@/utils/server'

/** 侧栏列表：提高 size，避免新建知识库落在第 2 页后「创建成功但看不见」 */
export const getKbList = () =>
  alovaInstance.Get('/knowledge-bases', { params: { page: 1, size: 100 } })

export const getKbForSelector = () =>
  alovaInstance.Get<KbSelectorResponse>('/knowledge-bases/for-selector')

export const createKb = (data: CreateKbRequest) => alovaInstance.Post('/knowledge-bases', data)

export const updateKb = (id: string, data: UpdateKbRequest) =>
  alovaInstance.Patch(`/knowledge-bases/${id}`, data)

export const deleteKb = (id: string) => alovaInstance.Delete(`/knowledge-bases/${id}`)

export const getKbDetail = (id: string) => alovaInstance.Get(`/knowledge-bases/${id}`)

export const uploadFile = (kbId: string, formData: FormData) =>
  alovaInstance.Post(`/knowledge-bases/${kbId}/documents/upload`, formData)

export const searchKbItems = (kbId: string, query: string) =>
  alovaInstance.Get(`/knowledge-bases/${kbId}/search`, {
    params: { q: query },
  })

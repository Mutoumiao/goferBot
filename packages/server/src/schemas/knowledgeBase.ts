import { z } from 'zod'

export const kbSchema = z.object({
  name: z.string().min(1).max(50).regex(/^[^<>\\/:*?"|]+$/),
  description: z.string().max(500).optional(),
}).strict()

export const kbIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type CreateKnowledgeBaseRequest = z.infer<typeof kbSchema>

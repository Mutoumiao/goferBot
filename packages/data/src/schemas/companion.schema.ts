import { z } from 'zod'

export const createCompanionSchema = z.object({
  name: z.string().min(1).max(100),
  headline: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  personality: z.string().max(2000).optional(),
  tone: z.string().max(500).optional(),
  boundaries: z.string().max(2000).optional(),
  guardrailsPrompt: z.string().max(3000).optional(),
  defaultPrompt: z.string().max(3000).optional(),
  avatarKey: z.string().max(500).optional(),
  backgroundStory: z.string().max(5000).optional(),
  openingMessage: z.string().max(500).optional(),
  visibility: z.string().max(50).optional(),
})

export const updateCompanionSchema = createCompanionSchema.partial()

export const companionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export const createConversationSchema = z.object({
  companionId: z.string().min(1),
  title: z.string().max(200).optional(),
})

export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
  companionId: z.string().min(1).optional(),
})

export const sendMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1).max(10000),
})

export const messageListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
  conversationId: z.string().min(1),
})

export const createMemorySchema = z.object({
  companionId: z.string().min(1),
  type: z.enum([
    'preference',
    'boundary',
    'relationship_goal',
    'conversation_style',
    'important_fact',
  ]),
  content: z.string().min(1).max(5000),
  importance: z.number().int().min(1).max(5).default(3),
})

export const memoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
  companionId: z.string().min(1).optional(),
  status: z.enum(['active', 'disabled', 'deleted']).optional(),
})

export const createFeedbackSchema = z.object({
  companionId: z.string().min(1),
  conversationId: z.string().min(1),
  rating: z.enum(['positive', 'negative']),
  reason: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
})

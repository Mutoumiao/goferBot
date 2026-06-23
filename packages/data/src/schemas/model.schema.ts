import { z } from 'zod'

export const modelConfigSchema = z.object({
  id: z.string(),
  provider: z.string(),
  model: z.string(),
  endpoint: z.string(),
  apiKeyMasked: z.string(),
  isActive: z.boolean(),
  isBuiltIn: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const createModelRequestSchema = z.object({
  provider: z.string(),
  model: z.string(),
  endpoint: z.string(),
  apiKey: z.string(),
})

export const updateModelRequestSchema = z.object({
  model: z.string().optional(),
  endpoint: z.string().optional(),
  apiKey: z.string().optional(),
  isActive: z.boolean().optional(),
})

export const testConnectionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  latencyMs: z.number().optional(),
})

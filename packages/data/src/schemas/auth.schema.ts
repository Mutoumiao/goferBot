import { z } from 'zod'

// ===== Auth Schemas =====

export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z.string().min(1, 'Password cannot be empty').max(4096, 'Password data anomaly'),
})

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z.string().min(1, 'Password cannot be empty').max(4096, 'Password data anomaly'),
  name: z.string().min(1, 'Name is required').max(100),
})

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
})

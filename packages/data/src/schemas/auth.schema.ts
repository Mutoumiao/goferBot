import { z } from 'zod'

export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(4096, 'Password data anomaly'),
})

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(4096, 'Password data anomaly'),
  name: z.string().min(1, 'Name is required').max(100).optional(),
})

export const updateProfileRequestSchema = z.object({
  name: z.string().min(1, '昵称不能为空').max(50, '昵称过长').describe('用户昵称'),
})

export const userRoleSchema = z.enum(['USER', 'ADMIN'])

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: userRoleSchema.default('USER'),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const authResponseSchema = z.object({
  accessToken: z.string(),
  user: userSchema,
})

export const publicKeyResponseSchema = z.object({
  publicKey: z.string(),
  algorithm: z.string(),
  hash: z.string(),
})

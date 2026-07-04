import { z } from 'zod'

export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(4096, 'Password data anomaly'),
  captchaId: z.string().min(1).optional(),
  captchaCode: z.string().min(1).optional(),
})

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  encryptedPassword: z
    .string()
    .min(1, 'Password cannot be empty')
    .max(4096, 'Password data anomaly'),
  invitationCode: z.string().min(1, 'Invitation code is required').max(64),
  name: z.string().min(1, 'Name is required').max(100).optional(),
})

export const updateProfileRequestSchema = z.object({
  name: z.string().min(1, '昵称不能为空').max(50, '昵称过长').describe('用户昵称'),
})

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatar: z.string().nullable().optional(),
  roles: z.array(z.string()).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const authResponseSchema = z.object({
  user: userSchema,
})

export const publicKeyResponseSchema = z.object({
  publicKey: z.string(),
  algorithm: z.string(),
  hash: z.string(),
})

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, '当前密码不能为空'),
  newPassword: z.string().min(8, '密码至少 8 个字符').max(128, '密码过长'),
})

export const refreshResponseSchema = z.object({
  success: z.boolean(),
})

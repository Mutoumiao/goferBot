import { z } from 'zod'

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/),
  name: z.string().min(1).max(50).optional(),
}).strict()

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict()

export type SignUpRequest = z.infer<typeof signUpSchema>
export type SignInRequest = z.infer<typeof signInSchema>

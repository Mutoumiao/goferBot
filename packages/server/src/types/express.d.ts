import type { JwtAccessPayload } from '../auth/auth.service.js'

declare global {
  namespace Express {
    interface User {
      id: string
      email: string
      name?: string | null
      avatar?: string | null
    }
  }
}

export {}

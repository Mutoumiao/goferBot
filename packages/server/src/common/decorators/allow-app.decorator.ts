import { SetMetadata } from '@nestjs/common'

export type AllowAppMode = 'web' | 'admin' | 'both' | 'public'

export const ALLOW_APP_KEY = 'allowApp'

export const AllowApp = (mode: AllowAppMode) => SetMetadata(ALLOW_APP_KEY, mode)

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

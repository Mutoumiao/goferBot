import { SetMetadata } from '@nestjs/common'

export const BYPASS_RESPONSE_KEY = 'bypassResponse'
export const BypassResponse = () => SetMetadata(BYPASS_RESPONSE_KEY, true)

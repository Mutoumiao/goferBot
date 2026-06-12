import { createFileRoute, redirect } from '@tanstack/react-router'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/chat')({
  beforeLoad: () => {
    const tempId = `temp_${crypto.randomUUID()}`
    const chatPath = ROUTES_REGISTER.chat.bindTo?.(tempId) ?? `/chat/${tempId}`
    throw redirect({ to: chatPath })
  },
  component: () => null,
})

import { createFileRoute } from '@tanstack/react-router'
import { RecycleBinPage } from '@/features/recycle/RecycleBinPage'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/_authenticated/recycle')({
  component: RecycleBinPage,
  staticData: {
    meta: ROUTES_REGISTER.recycle,
    keepAlive: true,
  },
})

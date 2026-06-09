import { createFileRoute } from '@tanstack/react-router'
import { KbListPage } from './kb/page'

export const Route = createFileRoute('/app/kb')({
  component: KbListPage,
})

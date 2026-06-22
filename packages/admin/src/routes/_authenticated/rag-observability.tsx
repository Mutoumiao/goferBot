import { createFileRoute } from '@tanstack/react-router'
import { RAGStatusBoard } from '@/features/rag-observability/components/RAGStatusBoard'

export const Route = createFileRoute('/_authenticated/rag-observability')({
  component: RAGStatusBoard,
})

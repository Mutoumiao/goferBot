import CreateKbDialog from './CreateKbDialog'
import { updateKb } from '@/api/KnowledgeBase'
import type { CreateKbRequest, KbEntry } from '@goferbot/data'

interface EditKbDialogProps {
  entry: KbEntry
  onClose?: (result?: unknown) => void
  onConfirm?: () => void | Promise<void>
}

export default function EditKbDialog({ entry, onClose, onConfirm }: EditKbDialogProps) {
  return (
    <CreateKbDialog
      initialData={{
        id: entry.id,
        name: entry.name,
        description: entry.description ?? '',
      }}
      onClose={onClose}
      onConfirm={onConfirm}
      onSave={async (id: string, data: CreateKbRequest) => {
        await updateKb(id, data).send()
      }}
    />
  )
}

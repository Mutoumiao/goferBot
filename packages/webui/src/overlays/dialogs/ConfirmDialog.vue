<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'
import { AlertCircleIcon } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  kind?: 'info' | 'warning' | 'danger'
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}>(), {
  confirmText: '确定',
  cancelText: '取消',
  kind: 'info',
})

const { isOpen, close } = defineDialog()

const kindClasses: Record<string, string> = {
  info: 'text-accent-500',
  warning: 'text-amber-500',
  danger: 'text-danger-500',
}

const btnClasses: Record<string, string> = {
  info: 'bg-accent-500 hover:bg-accent-600',
  warning: 'bg-amber-500 hover:bg-amber-600',
  danger: 'bg-danger-500 hover:bg-danger-600',
}

async function handleConfirm() {
  await props.onConfirm?.()
  close()
}

function handleCancel() {
  props.onCancel?.()
  close()
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-80">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <div class="flex items-start gap-3">
        <AlertCircleIcon class="size-8 shrink-0" :class="kindClasses[kind]" />
        <p class="text-sm text-text-secondary leading-relaxed">{{ message }}</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" class="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary" @click="handleCancel">
          {{ cancelText }}
        </Button>
        <Button class="rounded-lg px-3 py-1.5 text-sm text-white" :class="btnClasses[kind]" @click="handleConfirm">
          {{ confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmText?: string
  kind?: 'info' | 'warning' | 'danger'
  onConfirm: () => void | Promise<void>
}>(), {
  confirmText: '删除',
  kind: 'danger',
})

const { isOpen, close } = defineDialog()
const isDeleting = ref(false)

const btnClasses: Record<string, string> = {
  info: 'bg-accent-500 hover:bg-accent-600',
  warning: 'bg-amber-500 hover:bg-amber-600',
  danger: 'bg-danger-500 hover:bg-danger-600',
}

async function handleConfirm() {
  isDeleting.value = true
  try {
    await props.onConfirm()
    close()
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>
      <p class="text-sm text-text-secondary" v-html="message"></p>
      <DialogFooter>
        <Button variant="ghost" class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="close">
          取消
        </Button>
        <Button class="rounded-xl px-3 py-1.5 text-sm text-white" :class="btnClasses[kind]" :disabled="isDeleting" @click="handleConfirm">
          {{ isDeleting ? '删除中...' : confirmText }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

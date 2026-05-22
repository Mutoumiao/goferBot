<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { defineDialog } from '@/overlays/composables/useDialog'

const props = defineProps<{
  kbId: string
  parentFolderId?: string | null
  onConfirm: (name: string) => void | Promise<void>
}>()

const { isOpen, close } = defineDialog()
const name = ref('')
const error = ref('')
const isSubmitting = ref(false)

async function handleConfirm() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '请输入文件夹名称'
    return
  }
  isSubmitting.value = true
  try {
    await props.onConfirm(trimmed)
    close()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '创建失败'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="(v) => !v && close()">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>新建文件夹</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <Input
          v-model="name"
          type="text"
          placeholder="输入文件夹名称"
          class="rounded-xl border-border-default bg-surface-1 px-3 py-2.5 text-sm focus:border-accent-500/50"
          @keyup.enter="handleConfirm"
        />
        <p v-if="error" class="text-xs text-danger-500">{{ error }}</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="close">
          取消
        </Button>
        <Button class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" :disabled="isSubmitting" @click="handleConfirm">
          {{ isSubmitting ? '创建中...' : '创建' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

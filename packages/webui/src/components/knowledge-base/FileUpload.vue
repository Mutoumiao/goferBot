<script setup lang="ts">
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileIcon,
  XIcon,
  UploadIcon,
  AlertCircleIcon,
  CheckIcon,
  LoaderIcon,
} from 'lucide-vue-next'

const props = defineProps<{
  kbId: string | null
  folderId: string | null
}>()

const emit = defineEmits<{
  uploaded: []
}>()

interface UploadFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

const showDialog = ref(false)
const files = ref<UploadFile[]>([])
const isUploading = ref(false)

const canUpload = computed(() =>
  files.value.some((f) => f.status === 'pending' || f.status === 'error'),
)

const allDone = computed(() =>
  files.value.length > 0 && files.value.every((f) => f.status === 'success'),
)

function open() {
  files.value = []
  showDialog.value = true
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    addFiles(Array.from(input.files))
  }
  input.value = ''
}

function addFiles(selected: File[]) {
  for (const file of selected) {
    const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const uploadFile: UploadFile = {
      file,
      id,
      status: 'pending',
      progress: 0,
    }

    // 前端校验
    if (file.size > 50 * 1024 * 1024) {
      uploadFile.status = 'error'
      uploadFile.error = '超过 50MB 限制'
    } else {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const allowed = ['md', 'txt', 'pdf']
      if (!ext || !allowed.includes(ext)) {
        uploadFile.status = 'error'
        uploadFile.error = '不支持的格式'
      }
      if (/[\x00-\x1f\x7f]|\.\.|\/|\\/.test(file.name)) {
        uploadFile.status = 'error'
        uploadFile.error = '文件名非法'
      }
    }

    files.value.push(uploadFile)
  }
}

function removeFile(id: string) {
  files.value = files.value.filter((f) => f.id !== id)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function startUpload() {
  if (!props.kbId || isUploading.value) return
  isUploading.value = true

  for (const item of files.value) {
    if (item.status !== 'pending' && item.status !== 'error') continue

    item.status = 'uploading'
    item.progress = 0
    item.error = undefined

    const formData = new FormData()
    formData.append('file', item.file)
    if (props.folderId) {
      formData.append('folderId', props.folderId)
    }

    try {
      await api.uploadFile(
        `/api/knowledge-bases/${props.kbId}/documents/upload`,
        formData,
        (percent) => { item.progress = percent },
      )
      item.status = 'success'
      item.progress = 100
    } catch (e) {
      item.status = 'error'
      item.error = e instanceof Error ? e.message : '上传失败'
    }
  }

  isUploading.value = false

  if (allDone.value) {
    emit('uploaded')
    setTimeout(() => {
      showDialog.value = false
      files.value = []
    }, 600)
  }
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const dropped = e.dataTransfer?.files
  if (dropped) {
    addFiles(Array.from(dropped))
    showDialog.value = true
  }
}

defineExpose({ open, handleDrop })
</script>

<template>
  <div>
    <slot />

    <Dialog :open="showDialog" @update:open="(v) => !v && (showDialog = false)">
      <DialogContent class="w-[480px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>上传文件</DialogTitle>
        </DialogHeader>

        <div class="space-y-3">
          <!-- File select input -->
          <label
            class="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border-default bg-surface-1 p-6 transition-colors hover:border-accent-500/50 hover:bg-surface-2"
          >
            <UploadIcon class="size-6 text-text-tertiary" />
            <span class="text-sm text-text-secondary">点击选择文件或拖拽到此处</span>
            <span class="text-xs text-text-tertiary">支持 Markdown、TXT、PDF，单个不超过 50MB</span>
            <input
              type="file"
              multiple
              accept=".md,.txt,.pdf,text/markdown,text/plain,application/pdf"
              class="hidden"
              @change="handleFileSelect"
            />
          </label>

          <!-- File list -->
          <div v-if="files.length > 0" class="space-y-2">
            <div
              v-for="item in files"
              :key="item.id"
              class="flex items-center gap-3 rounded-lg border border-border-default bg-white px-3 py-2"
              :class="item.status === 'error' ? 'border-danger-500/30 bg-danger-50' : ''"
            >
              <FileIcon class="size-5 text-text-tertiary" />
              <div class="flex-1 min-w-0">
                <p class="truncate text-sm text-text-primary">{{ item.file.name }}</p>
                <p class="text-xs text-text-tertiary">{{ formatSize(item.file.size) }}</p>
              </div>

              <!-- Progress or status -->
              <div v-if="item.status === 'uploading'" class="w-20">
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    class="h-full rounded-full bg-accent-500 transition-all"
                    :style="{ width: `${item.progress}%` }"
                  />
                </div>
                <p class="mt-0.5 text-right text-[10px] text-text-tertiary">{{ item.progress }}%</p>
              </div>

              <CheckIcon v-else-if="item.status === 'success'" class="size-5 text-success-500" />
              <div v-else-if="item.status === 'error'" class="flex items-center gap-1 text-danger-500">
                <AlertCircleIcon class="size-4" />
                <span class="text-xs">{{ item.error }}</span>
              </div>

              <Button
                v-if="item.status !== 'uploading' && item.status !== 'success'"
                variant="ghost"
                size="icon-xs"
                class="text-text-tertiary"
                @click="removeFile(item.id)"
              >
                <XIcon class="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            class="rounded-xl px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2"
            @click="showDialog = false"
          >
            取消
          </Button>
          <Button
            class="rounded-xl bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600"
            :disabled="!canUpload || isUploading"
            @click="startUpload"
          >
            <LoaderIcon v-if="isUploading" class="mr-1 size-4 animate-spin" />
            {{ isUploading ? '上传中...' : '开始上传' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

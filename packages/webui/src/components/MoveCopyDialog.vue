<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { getBackend } from '@goferbot/backend-adapters'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DatabaseIcon,
  ChevronRightIcon,
  LoaderIcon,
  FolderOpenIcon,
  FolderIcon,
} from 'lucide-vue-next'
import type { KnowledgeBase } from '@/types'

const props = defineProps<{
  visible: boolean
  mode: 'move' | 'copy'
  sourceKbId: string
  sourcePath: string
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useKnowledgeBaseStore()
const selectedTargetKbId = ref('')
const targetPath = ref('')
const targetBreadcrumb = ref<string[]>([])

const targetKb = computed(() =>
  store.knowledgeBases.find((kb) => kb.id === selectedTargetKbId.value)
)

const targetFiles = ref<Array<{ name: string; type: string }>>([])
const isLoading = ref(false)

watch(
  () => props.visible,
  async (val) => {
    if (val) {
      selectedTargetKbId.value = props.sourceKbId
      targetPath.value = ''
      targetBreadcrumb.value = []
      await loadTargetFiles()
    }
  }
)

async function loadTargetFiles() {
  if (!selectedTargetKbId.value) return
  isLoading.value = true
  try {
    const backend = getBackend()
    const res = await backend.request(
      'GET',
      `/knowledge-bases/${selectedTargetKbId.value}/files?path=${encodeURIComponent(targetPath.value)}`
    )
    const data = await res.json()
    targetFiles.value = (data.items || []).filter((item: { type: string }) => item.type === 'directory')
  } catch {
    targetFiles.value = []
  } finally {
    isLoading.value = false
  }
}

function onSelectKb(kb: KnowledgeBase) {
  selectedTargetKbId.value = kb.id
  targetPath.value = ''
  targetBreadcrumb.value = []
  loadTargetFiles()
}

function onEnterFolder(folderName: string) {
  targetBreadcrumb.value.push(folderName)
  targetPath.value = targetBreadcrumb.value.join('/')
  loadTargetFiles()
}

function onBreadcrumbClick(index: number) {
  if (index === -1) {
    targetBreadcrumb.value = []
    targetPath.value = ''
  } else {
    targetBreadcrumb.value = targetBreadcrumb.value.slice(0, index + 1)
    targetPath.value = targetBreadcrumb.value.join('/')
  }
  loadTargetFiles()
}

async function onConfirm() {
  if (props.mode === 'move') {
    await store.moveFile(props.sourceKbId, props.sourcePath, selectedTargetKbId.value, targetPath.value)
  } else {
    await store.copyFile(props.sourceKbId, props.sourcePath, selectedTargetKbId.value, targetPath.value)
  }
  emit('close')
}
</script>

<template>
  <Dialog :open="visible" @update:open="(v) => !v && emit('close')">
    <DialogContent class="flex h-[480px] w-[640px] max-w-[640px] flex-col p-0">
      <DialogHeader class="border-b border-border-default px-5 py-3">
        <DialogTitle class="text-base font-medium text-text-primary">
          {{ mode === 'move' ? '移动到' : '复制到' }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex flex-1 overflow-hidden">
        <!-- Left: KB list -->
        <div class="w-48 border-r border-border-default overflow-auto p-2">
          <div
            v-for="kb in store.knowledgeBases"
            :key="kb.id"
            class="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors"
            :class="selectedTargetKbId === kb.id ? 'bg-accent-soft text-accent-500' : 'text-text-secondary hover:bg-surface-2'"
            @click="onSelectKb(kb)"
          >
            <DatabaseIcon class="size-5 shrink-0" />
            <span class="truncate">{{ kb.name }}</span>
          </div>
        </div>

        <!-- Right: folder list with breadcrumb -->
        <div class="flex flex-1 flex-col">
          <div class="flex items-center gap-1 border-b border-border-default px-3 py-2">
            <Button variant="ghost" size="sm" class="h-auto px-1 py-0 text-sm text-text-secondary hover:text-text-primary" @click="onBreadcrumbClick(-1)">根目录</Button>
            <template v-for="(seg, idx) in targetBreadcrumb" :key="idx">
              <ChevronRightIcon class="size-3 text-text-tertiary" />
              <Button variant="ghost" size="sm" class="h-auto px-1 py-0 text-sm text-text-secondary hover:text-text-primary" @click="onBreadcrumbClick(idx)">{{ seg }}</Button>
            </template>
          </div>

          <div class="flex-1 overflow-auto p-2">
            <div v-if="isLoading" class="flex h-full items-center justify-center">
              <LoaderIcon class="size-8 animate-spin text-accent-500" />
            </div>
            <div v-else-if="targetFiles.length === 0" class="flex h-full flex-col items-center justify-center text-text-tertiary">
              <FolderOpenIcon class="size-16" />
              <span class="text-sm mt-1">暂无子文件夹</span>
            </div>
            <div
              v-for="folder in targetFiles"
              :key="folder.name"
              class="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2"
              @dblclick="onEnterFolder(folder.name)"
            >
              <FolderIcon class="size-5 text-amber-400" />
              <span class="text-sm text-text-primary">{{ folder.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="border-t border-border-default px-5 py-3">
        <Button variant="ghost" class="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2" @click="emit('close')">取消</Button>
        <Button class="rounded-lg bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" @click="onConfirm">
          {{ mode === 'move' ? '移动至此' : '复制至此' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

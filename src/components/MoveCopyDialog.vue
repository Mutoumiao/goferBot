<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { getSidecarPort } from '@/utils/sidecarClient'
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
    const port = getSidecarPort() || 11451
    const res = await fetch(
      `http://127.0.0.1:${port}/knowledge-bases/${selectedTargetKbId.value}/files?path=${encodeURIComponent(targetPath.value)}`
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
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="emit('close')"
      >
        <div class="flex h-[480px] w-[640px] flex-col rounded-lg border border-surface-3 bg-surface-1 shadow-xl">
          <div class="border-b border-surface-3 px-5 py-3">
            <h3 class="text-base font-medium text-text-primary">
              {{ mode === 'move' ? '移动到' : '复制到' }}
            </h3>
          </div>

          <div class="flex flex-1 overflow-hidden">
            <!-- Left: KB list -->
            <div class="w-48 border-r border-surface-3 overflow-auto p-2">
              <div
                v-for="kb in store.knowledgeBases"
                :key="kb.id"
                class="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors"
                :class="selectedTargetKbId === kb.id ? 'bg-accent-600/15 text-accent-400' : 'text-text-secondary hover:bg-surface-2'"
                @click="onSelectKb(kb)"
              >
                <span :class="`i-${kb.icon || 'mdi-database'} text-lg`" />
                <span class="truncate">{{ kb.name }}</span>
              </div>
            </div>

            <!-- Right: folder list with breadcrumb -->
            <div class="flex flex-1 flex-col">
              <div class="flex items-center gap-1 border-b border-surface-3 px-3 py-2">
                <button class="text-sm text-text-secondary hover:text-text-primary" @click="onBreadcrumbClick(-1)">根目录</button>
                <template v-for="(seg, idx) in targetBreadcrumb" :key="idx">
                  <span class="i-mdi-chevron-right text-xs text-text-tertiary" />
                  <button class="text-sm text-text-secondary hover:text-text-primary" @click="onBreadcrumbClick(idx)">{{ seg }}</button>
                </template>
              </div>

              <div class="flex-1 overflow-auto p-2">
                <div v-if="isLoading" class="flex h-full items-center justify-center">
                  <span class="i-mdi-loading animate-spin text-2xl text-accent-500" />
                </div>
                <div v-else-if="targetFiles.length === 0" class="flex h-full flex-col items-center justify-center text-text-tertiary">
                  <span class="i-mdi-folder-open-outline text-4xl" />
                  <span class="text-sm mt-1">暂无子文件夹</span>
                </div>
                <div
                  v-for="folder in targetFiles"
                  :key="folder.name"
                  class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-surface-2"
                  @dblclick="onEnterFolder(folder.name)"
                >
                  <span class="i-mdi-folder text-lg text-amber-400" />
                  <span class="text-sm text-text-primary">{{ folder.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-surface-3 px-5 py-3">
            <button class="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2" @click="emit('close')">取消</button>
            <button class="rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500" @click="onConfirm">
              {{ mode === 'move' ? '移动至此' : '复制至此' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  initialName: string
  initialIcon: string
}>()

const emit = defineEmits<{
  close: []
  save: [name: string, icon: string]
}>()

const name = ref(props.initialName)
const icon = ref(props.initialIcon)
const error = ref('')

const iconOptions = [
  'mdi-database',
  'mdi-books',
  'mdi-bookshelf',
  'mdi-folder',
  'mdi-folder-open',
  'mdi-file-document',
  'mdi-notebook',
  'mdi-book-open-page-variant',
  'mdi-school',
  'mdi-brain',
]

watch(
  () => props.visible,
  (val) => {
    if (val) {
      name.value = props.initialName
      icon.value = props.initialIcon
      error.value = ''
    }
  }
)

function onSave() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '请输入知识库名称'
    return
  }
  emit('save', trimmed, icon.value)
}
</script>

<template>
  <!-- Safelist for tailwindcss-icons JIT scanner -->
  <div class="hidden">
    <span class="i-mdi-database i-mdi-books i-mdi-bookshelf i-mdi-folder i-mdi-folder-open i-mdi-file-document i-mdi-notebook i-mdi-book-open-page-variant i-mdi-school i-mdi-brain" />
  </div>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        @click.self="emit('close')"
      >
        <div class="w-96 rounded-lg border border-surface-3 bg-surface-1 p-5 shadow-xl">
          <h3 class="mb-3 text-base font-medium text-text-primary">修改资料</h3>

          <div class="mb-4">
            <label class="mb-1 block text-xs text-text-secondary">名称</label>
            <input
              v-model="name"
              type="text"
              class="w-full rounded-md border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-500"
              @keyup.enter="onSave"
            />
            <p v-if="error" class="mt-1 text-xs text-red-400">{{ error }}</p>
          </div>

          <div class="mb-4">
            <label class="mb-2 block text-xs text-text-secondary">图标</label>
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="opt in iconOptions"
                :key="opt"
                class="flex h-10 items-center justify-center rounded-md border transition-colors"
                :class="icon === opt ? 'border-accent-500 bg-accent-500/10 text-accent-400' : 'border-surface-3 text-text-tertiary hover:bg-surface-2'"
                @click="icon = opt"
              >
                <span :class="`i-${opt} text-lg`" />
              </button>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button
              class="rounded-md px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              class="rounded-md bg-accent-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-accent-500"
              @click="onSave"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

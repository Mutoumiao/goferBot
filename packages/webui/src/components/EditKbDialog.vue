<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DatabaseIcon,
  BookIcon,
  LibraryIcon,
  FolderIcon,
  FolderOpenIcon,
  FileTextIcon,
  BookOpenIcon,
  GraduationCapIcon,
  BrainIcon,
} from 'lucide-vue-next'

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
  { name: 'mdi-database', component: DatabaseIcon },
  { name: 'mdi-books', component: BookIcon },
  { name: 'mdi-bookshelf', component: LibraryIcon },
  { name: 'mdi-folder', component: FolderIcon },
  { name: 'mdi-folder-open', component: FolderOpenIcon },
  { name: 'mdi-file-document', component: FileTextIcon },
  { name: 'mdi-notebook', component: BookOpenIcon },
  { name: 'mdi-book-open-page-variant', component: BookOpenIcon },
  { name: 'mdi-school', component: GraduationCapIcon },
  { name: 'mdi-brain', component: BrainIcon },
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
  <Dialog :open="visible" @update:open="(v) => !v && emit('close')">
    <DialogContent class="w-96">
      <DialogHeader>
        <DialogTitle>修改资料</DialogTitle>
      </DialogHeader>

      <div class="space-y-4">
        <div>
          <label class="mb-1 block text-xs text-text-secondary">名称</label>
          <Input
            v-model="name"
            type="text"
            data-testid="edit-kb-name-input"
            class="rounded-xl border-border-default bg-surface-1 px-3 py-2 text-sm focus:border-accent-500"
            @keyup.enter="onSave"
          />
          <p v-if="error" class="mt-1 text-xs text-danger-500">{{ error }}</p>
        </div>

        <div>
          <label class="mb-2 block text-xs text-text-secondary">图标</label>
          <div class="grid grid-cols-5 gap-2">
            <Button
              v-for="opt in iconOptions"
              :key="opt.name"
              variant="ghost"
              size="icon-sm"
              class="flex h-10 items-center justify-center rounded-xl border transition-colors"
              :class="icon === opt.name ? 'border-accent-500 bg-accent-soft text-accent-500 hover:bg-accent-soft' : 'border-border-default text-text-tertiary hover:bg-surface-2'"
              @click="icon = opt.name"
            >
              <Component :is="opt.component" class="size-5" />
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" class="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary" @click="emit('close')">
          取消
        </Button>
        <Button class="rounded-lg bg-accent-500 px-3 py-1.5 text-sm text-white hover:bg-accent-600" @click="onSave">
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

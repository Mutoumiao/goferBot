<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  kind?: 'info' | 'warning' | 'danger'
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const kindClasses = {
  info: 'text-accent-500',
  warning: 'text-amber-500',
  danger: 'text-danger-500',
}

const btnClasses = {
  info: 'bg-accent-500 hover:bg-accent-600',
  warning: 'bg-amber-500 hover:bg-amber-600',
  danger: 'bg-danger-500 hover:bg-danger-600',
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="emit('cancel')"
      >
        <div class="w-80 rounded-2xl border border-border-default bg-white p-5 shadow-xl">
          <div class="mb-4 flex items-start gap-3">
            <span
              class="i-mdi-alert-circle text-2xl shrink-0"
              :class="kindClasses[kind || 'info']"
            />
            <div>
              <h3 class="text-base font-medium text-text-primary">{{ title }}</h3>
              <p class="mt-1 text-sm text-text-secondary leading-relaxed">{{ message }}</p>
            </div>
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
              @click="emit('cancel')"
            >
              {{ cancelText || '取消' }}
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm text-white transition-colors"
              :class="btnClasses[kind || 'info']"
              @click="emit('confirm')"
            >
              {{ confirmText || '确定' }}
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

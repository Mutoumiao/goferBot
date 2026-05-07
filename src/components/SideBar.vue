<script setup lang="ts">
const emit = defineEmits<{
  openChat: []
  openKnowledgeBase: []
  openHistory: []
  openSettings: []
}>()
</script>

<template>
  <div class="flex w-16 shrink-0 flex-col items-center gap-4 border-r border-gray-700 bg-gray-800 py-4">
    <div class="flex flex-col gap-4">
      <button
        class="icon-[mdi--message-text] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="问答"
        @click="emit('openChat')"
      />
      <button
        class="icon-[mdi--folder] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="知识库"
        @click="emit('openKnowledgeBase')"
      />
    </div>
    <div class="mt-auto flex flex-col gap-4">
      <button
        class="icon-[mdi--history] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="历史"
        @click="emit('openHistory')"
      />
      <button
        class="icon-[mdi--cog] text-2xl text-gray-400 transition-colors hover:text-blue-400"
        title="设置"
        @click="emit('openSettings')"
      />
    </div>
  </div>
</template>

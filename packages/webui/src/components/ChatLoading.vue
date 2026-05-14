<script setup lang="ts">
import { LoaderIcon } from 'lucide-vue-next'
</script>

<template>
  <div data-testid="chat-loading" class="my-2 flex items-center gap-2 text-sm text-text-tertiary">
    <LoaderIcon class="size-4 animate-spin" />
    <span>思考中...</span>
  </div>
</template>

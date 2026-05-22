<script setup lang="ts">
import { provide, onErrorCaptured } from 'vue'
import { OverlayCloseKey } from './symbols'
import type { OverlayItem } from '../types/overlay.types'

const props = defineProps<{
  item: OverlayItem
  onClose: () => void
}>()

provide(OverlayCloseKey, props.onClose)

onErrorCaptured((_err) => {
  props.onClose()
  return false
})
</script>

<template>
  <component :is="item.component" v-bind="item.props" />
</template>

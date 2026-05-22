<script setup lang="ts">
import { useOverlayHost } from './useOverlayHost'
import OverlayItem from './OverlayItem.vue'

const { overlays, removeOverlay } = useOverlayHost()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="overlays.length > 0"
      class="overlay-host fixed inset-0 pointer-events-none"
      style="z-index: 9999"
    >
      <OverlayItem
        v-for="(item, index) in overlays"
        :key="item.id"
        :item="item"
        :on-close="() => removeOverlay(item.id)"
        class="overlay-item absolute"
        :style="{ zIndex: 10000 + index, pointerEvents: 'auto' }"
      />
    </div>
  </Teleport>
</template>

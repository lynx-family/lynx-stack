<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  BackgroundDraggable.vue — element moved via Background Thread reactive state.

  Position is updated through Vue's reactive system (BG thread) then sent
  to Main Thread via the ops buffer. This introduces 2 thread crossings
  per scroll event, causing visible lag compared to MainThreadDraggable.
-->
<script setup lang="ts">
defineProps<{
  size: number
  posX: number
  posY: number
}>()
</script>

<template>
  <view
    :style="{
      height: `${size}px`,
      width: `${size}px`,
      backgroundColor: 'lightskyblue',
      transform: `translate(${posX}px, ${posY}px)`,
    }"
  >
    <text :style="{ fontSize: 12, color: '#333' }">BGDraggable</text>
  </view>
</template>

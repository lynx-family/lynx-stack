<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  MainThreadDraggable.vue — element moved directly on the Main Thread.

  Starts at translate(0, 500px). The MT scroll handler calls
  setStyleProperty("transform", ...) with zero latency.
-->
<script setup lang="ts">
import type { MainThreadRef } from '@lynx-js/vue-runtime'

defineProps<{
  size: number
  mtRef: MainThreadRef
}>()
</script>

<template>
  <view
    :main-thread-ref="mtRef"
    :style="{
      height: `${size}px`,
      width: `${size}px`,
      backgroundColor: 'lightskyblue',
      transform: 'translate(0px, 500px)',
    }"
  >
    <text :style="{ fontSize: 12, color: '#333' }">MTDraggable</text>
  </view>
</template>

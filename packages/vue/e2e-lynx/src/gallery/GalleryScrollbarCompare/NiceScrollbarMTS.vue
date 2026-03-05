<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  NiceScrollbarMTS.vue — MTS scrollbar for the comparison demo.

  Positioned at right: 14px with darkkhaki background to distinguish
  from the BTS scrollbar at right: 3px. Matching React's ScrollbarCompare.

  Tutorial step: gallery-scrollbar-compare
-->
<script setup lang="ts">
import type { MainThreadRef } from '@lynx-js/vue-runtime';

defineProps<{
  thumbRef: MainThreadRef;
}>();
</script>

<template>
  <view
    class="scrollbar"
    :main-thread-ref="thumbRef"
    :style="{
      right: '14px',
      backgroundColor: 'darkkhaki',
      height: '60px',
      top: '0px',
    }"
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>

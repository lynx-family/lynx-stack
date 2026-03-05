<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  NiceScrollbarMTS.vue — Main Thread Script scrollbar.

  The scrollbar is updated directly on the Main Thread via
  :main-thread-ref. Uses React Gallery's gradient/glow styling.

  Tutorial step: gallery-complete
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
      height: '60px',
      top: '0px',
    }"
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>

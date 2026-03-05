<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  NiceScrollbar.vue — BTS scrollbar for the comparison demo.

  Positioned at right: 3px to sit next to the MTS scrollbar at right: 14px.
  Uses full screen height (no -48 offset) matching React's ScrollbarCompare.

  Tutorial step: gallery-scrollbar-compare
-->
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

declare const SystemInfo: { pixelHeight: number; pixelRatio: number };

const scrollbarHeight = ref(0);
const scrollbarTop = ref(0);

function adjustScrollbar(scrollTop: number, scrollHeight: number) {
  const listHeight = SystemInfo.pixelHeight / SystemInfo.pixelRatio;
  scrollbarHeight.value = listHeight * (listHeight / scrollHeight);
  scrollbarTop.value = listHeight * (scrollTop / scrollHeight);
}

defineExpose({ adjustScrollbar });
</script>

<template>
  <view
    class="scrollbar"
    :style="{ right: '3px', height: scrollbarHeight + 'px', top: scrollbarTop + 'px' }"
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>

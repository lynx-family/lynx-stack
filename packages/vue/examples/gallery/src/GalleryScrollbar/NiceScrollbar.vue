<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  NiceScrollbar.vue — Custom scrollbar driven by Background Thread.

  Exposes an `adjustScrollbar` method via defineExpose. The parent
  component calls this method from its @scroll handler to update the
  scrollbar position and size. Uses SystemInfo for dynamic height.

  Tutorial step: gallery-scrollbar
-->
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

declare const SystemInfo: { pixelHeight: number; pixelRatio: number };

const scrollbarHeight = ref(0);
const scrollbarTop = ref(0);

function adjustScrollbar(scrollTop: number, scrollHeight: number) {
  const listHeight = SystemInfo.pixelHeight / SystemInfo.pixelRatio - 48;
  scrollbarHeight.value = listHeight * (listHeight / scrollHeight);
  scrollbarTop.value = listHeight * (scrollTop / scrollHeight);
}

defineExpose({ adjustScrollbar });
</script>

<template>
  <view
    class="scrollbar"
    :style="{ height: scrollbarHeight + 'px', top: scrollbarTop + 'px' }"
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>

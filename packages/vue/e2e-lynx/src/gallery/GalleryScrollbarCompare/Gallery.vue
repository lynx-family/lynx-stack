<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  Gallery.vue — Gallery with both BTS and MTS scrollbars side by side.

  Shows the BTS scrollbar (right: 3px, gradient) next to the MTS scrollbar
  (right: 14px, darkkhaki) to visually compare lag vs smoothness.
  Matching React's ScrollbarCompare entry.

  Tutorial step: gallery-scrollbar-compare
-->
<script setup lang="ts">
import { ref, useMainThreadRef } from '@lynx-js/vue-runtime';

import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';

import LikeImageCard from '../Components/LikeImageCard.vue';
import NiceScrollbar from './NiceScrollbar.vue';
import NiceScrollbarMTS from './NiceScrollbarMTS.vue';

const scrollbarRef = ref<InstanceType<typeof NiceScrollbar> | null>(null);
const scrollbarThumbRef = useMainThreadRef(null);

// BTS scroll handler
function onScroll(event: { detail?: { scrollTop?: number; scrollHeight?: number } }) {
  const scrollTop = event.detail?.scrollTop ?? 0;
  const scrollHeight = event.detail?.scrollHeight ?? 0;
  scrollbarRef.value?.adjustScrollbar(scrollTop, scrollHeight);
}

// MTS scroll handler (worklet context)
const onScrollMTSCtx = {
  _wkltId: 'gallery:adjustScrollbarCompare',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
};
onScrollMTSCtx._c = { _thumbRef: scrollbarThumbRef.toJSON() };
</script>

<template>
  <view class="gallery-wrapper">
    <NiceScrollbar ref="scrollbarRef" />
    <NiceScrollbarMTS :thumb-ref="scrollbarThumbRef" />
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
      @scroll="onScroll"
      :main-thread-bindscroll="onScrollMTSCtx"
    >
      <list-item
        v-for="(pic, i) in furnituresPictures"
        :key="i"
        :item-key="String(i)"
        :estimated-main-axis-size-px="calculateEstimatedSize(pic.width, pic.height)"
      >
        <LikeImageCard :picture="pic" />
      </list-item>
    </list>
  </view>
</template>

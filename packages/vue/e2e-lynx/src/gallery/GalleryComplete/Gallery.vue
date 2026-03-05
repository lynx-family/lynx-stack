<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  Gallery.vue — Gallery with Main Thread Script scrollbar.

  Uses :main-thread-bindscroll to handle scroll events directly on
  the Main Thread. The worklet reads scrollTop/scrollHeight and calls
  setStyleProperty on the scrollbar thumb ref — no thread crossings.

  Tutorial step: gallery-complete
-->
<script setup lang="ts">
import { onMounted, nextTick, useMainThreadRef } from '@lynx-js/vue-runtime';

import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';

import LikeImageCard from '../Components/LikeImageCard.vue';
import NiceScrollbarMTS from './NiceScrollbarMTS.vue';

declare const lynx: {
  createSelectorQuery(): {
    select(selector: string): {
      invoke(options: { method: string; params: Record<string, string> }): {
        exec(): void;
      };
    };
  };
};

// MainThreadRef for the scrollbar thumb element
const scrollbarThumbRef = useMainThreadRef(null);

// Hand-crafted worklet context (Phase 1 — simulates SWC transform output)
const onScrollMTSCtx = {
  _wkltId: 'gallery:adjustScrollbarMTS',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
};

// Stamp the ref's _wvid into the closure so the MT handler can resolve it
onScrollMTSCtx._c = { _thumbRef: scrollbarThumbRef.toJSON() };

onMounted(() => {
  nextTick(() => {
    lynx
      .createSelectorQuery()
      .select('[custom-list-name="list-container"]')
      .invoke({
        method: 'autoScroll',
        params: { rate: '60', start: 'true' },
      })
      .exec();
  });
});
</script>

<template>
  <view class="gallery-wrapper">
    <NiceScrollbarMTS :thumb-ref="scrollbarThumbRef" />
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
      :main-thread-bindscroll="onScrollMTSCtx"
      :scroll-event-throttle="0"
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

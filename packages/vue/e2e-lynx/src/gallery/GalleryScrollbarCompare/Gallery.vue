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
import { ref, onMounted, nextTick, useMainThreadRef, useTemplateRef } from '@lynx-js/vue-runtime';
import type { ShadowElement } from '@lynx-js/vue-runtime';

import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';

import LikeImageCard from '../Components/LikeImageCard.vue';
import NiceScrollbar from './NiceScrollbar.vue';
import NiceScrollbarMTS from './NiceScrollbarMTS.vue';

declare const SystemInfo: { pixelHeight: number; pixelRatio: number };

const scrollbarRef = ref<InstanceType<typeof NiceScrollbar> | null>(null);
const scrollbarThumbRef = useMainThreadRef(null);
const listRef = useTemplateRef<ShadowElement>('listRef');

// BTS scroll handler
function onScroll(event: { detail?: { scrollTop?: number; scrollHeight?: number } }) {
  const scrollTop = event.detail?.scrollTop ?? 0;
  const scrollHeight = event.detail?.scrollHeight ?? 0;
  scrollbarRef.value?.adjustScrollbar(scrollTop, scrollHeight);
}

// MTS scrollbar adjuster — runs directly on Main Thread (no -48 offset, full height)
function adjustScrollbarCompare(
  scrollTop: number,
  scrollHeight: number,
  ref: { current?: { setStyleProperty?(k: string, v: string): void } },
) {
  'main thread';
  const listHeight = SystemInfo.pixelHeight / SystemInfo.pixelRatio;
  const scrollbarHeight = listHeight * (listHeight / scrollHeight);
  const scrollbarTop = listHeight * (scrollTop / scrollHeight);
  ref.current?.setStyleProperty?.('height', `${scrollbarHeight}px`);
  ref.current?.setStyleProperty?.('top', `${scrollbarTop}px`);
}

const onScrollMTS = (event: { detail: { scrollTop: number; scrollHeight: number } }) => {
  'main thread';
  adjustScrollbarCompare(event.detail.scrollTop, event.detail.scrollHeight, scrollbarThumbRef);
};

onMounted(() => {
  nextTick(() => {
    listRef.value
      ?.invoke({
        method: 'autoScroll',
        params: { rate: '60', start: 'true' },
      })
      .exec();
  });
});
</script>

<template>
  <view class="gallery-wrapper">
    <NiceScrollbar ref="scrollbarRef" />
    <NiceScrollbarMTS :thumb-ref="scrollbarThumbRef" />
    <list
      ref="listRef"
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      @scroll="onScroll"
      :main-thread-bindscroll="onScrollMTS"
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

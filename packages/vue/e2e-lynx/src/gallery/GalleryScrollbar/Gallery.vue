<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  Gallery.vue — Gallery with Background Thread scrollbar.

  Uses the @scroll event on the <list> to drive a custom scrollbar.
  The scroll handler runs on the Background Thread, so there's a small
  delay between scrolling and scrollbar updates.

  Tutorial step: gallery-scrollbar
-->
<script setup lang="ts">
import { ref, onMounted, nextTick, useTemplateRef } from '@lynx-js/vue-runtime';
import type { ShadowElement } from '@lynx-js/vue-runtime';

import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';

import LikeImageCard from '../Components/LikeImageCard.vue';
import NiceScrollbar from './NiceScrollbar.vue';

const scrollbarRef = ref<InstanceType<typeof NiceScrollbar> | null>(null);
const listRef = useTemplateRef<ShadowElement>('listRef');

function onScroll(event: { detail?: { scrollTop?: number; scrollHeight?: number } }) {
  const scrollTop = event.detail?.scrollTop ?? 0;
  const scrollHeight = event.detail?.scrollHeight ?? 0;
  scrollbarRef.value?.adjustScrollbar(scrollTop, scrollHeight);
}

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
    <list
      ref="listRef"
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      @scroll="onScroll"
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

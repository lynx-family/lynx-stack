<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  Gallery.vue — Gallery with auto-scroll feature.

  Demonstrates invoking native element methods via
  lynx.createSelectorQuery().select().invoke() to start auto-scrolling.
  Matching React's AddAutoScroll entry.

  Tutorial step: gallery-autoscroll
-->
<script setup lang="ts">
import { onMounted, nextTick } from '@lynx-js/vue-runtime';

import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';

import LikeImageCard from '../Components/LikeImageCard.vue';

declare const lynx: {
  createSelectorQuery(): {
    select(selector: string): {
      invoke(options: { method: string; params: Record<string, string> }): {
        exec(): void;
      };
    };
  };
};

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
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
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

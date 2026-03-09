<!--
  SwiperMTS — Main Thread Script touch handling for zero-latency drag.
  All touch event processing runs directly on the main thread via
  'main thread' directive functions, eliminating cross-thread round-trips.
-->
<script setup lang="ts">
import { useMainThreadRef } from '@lynx-js/vue-runtime';
import SwiperItem from '../Components/SwiperItem.vue';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(defineProps<{
  data: string[];
  itemWidth?: number;
}>(), {
  itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
});

// --- Main Thread refs ---
const containerRef = useMainThreadRef<unknown>(null);
const currentOffsetRef = useMainThreadRef<number>(0);
const touchStartXRef = useMainThreadRef<number>(0);
const touchStartOffsetRef = useMainThreadRef<number>(0);

// --- MTS touch handlers ---
const handleTouchStart = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  touchStartXRef.current = e.touches[0].clientX;
  touchStartOffsetRef.current = currentOffsetRef.current;
};

const handleTouchMove = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  const delta = e.touches[0].clientX - touchStartXRef.current;
  const offset = touchStartOffsetRef.current + delta;
  currentOffsetRef.current = offset;
  const el = containerRef as unknown as {
    current?: { setStyleProperty?(k: string, v: string): void };
  };
  if (el.current?.setStyleProperty) {
    el.current.setStyleProperty('transform', `translateX(${offset}px)`);
  }
};

const handleTouchEnd = () => {
  'main thread';
  touchStartXRef.current = 0;
  touchStartOffsetRef.current = 0;
};
</script>

<template>
  <view class="swiper-wrapper">
    <view
      class="swiper-container"
      :main-thread-ref="containerRef"
      :main-thread-bindtouchstart="handleTouchStart"
      :main-thread-bindtouchmove="handleTouchMove"
      :main-thread-bindtouchend="handleTouchEnd"
    >
      <SwiperItem
        v-for="(pic, index) in data"
        :key="index"
        :pic="pic"
        :item-width="props.itemWidth"
      />
    </view>
  </view>
</template>

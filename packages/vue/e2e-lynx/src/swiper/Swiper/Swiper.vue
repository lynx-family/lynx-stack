<!--
  Swiper (Full) — composable-based, matching React Lynx's abstraction.

  useUpdateSwiperStyle — containerRef + MT style setter
  useOffset            — touch handlers + offset clamping + animation + runOnBackground sync
  useAnimate           — shared RAF animation composable (in ../utils/)
-->
<script setup lang="ts">
import { ref } from 'vue';
import SwiperItem from '../Components/SwiperItem.vue';
import Indicator from '../Components/Indicator.vue';
import { useOffset } from './useOffset';
import { useUpdateSwiperStyle } from './useUpdateSwiperStyle';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(defineProps<{
  data: string[];
  itemWidth?: number;
  duration?: number;
  'main-thread-easing'?: (t: number) => number;
}>(), {
  itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
  duration: 300,
});

const currentIndex = ref(0);

const { containerRef, updateSwiperStyle } = useUpdateSwiperStyle();
const { handleTouchStart, handleTouchMove, handleTouchEnd, updateIndex } =
  useOffset({
    itemWidth: props.itemWidth,
    dataLength: props.data.length,
    onIndexUpdate: (index: number) => {
      currentIndex.value = index;
    },
    onOffsetUpdate: updateSwiperStyle,
    duration: props.duration,
    MTEasing: props['main-thread-easing'],
  });

function handleItemClick(index: number) {
  currentIndex.value = index;
  updateIndex(index);
}
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
        :item-width="itemWidth"
      />
    </view>
    <Indicator
      :total="data.length"
      :current="currentIndex"
      @item-click="handleItemClick"
    />
  </view>
</template>

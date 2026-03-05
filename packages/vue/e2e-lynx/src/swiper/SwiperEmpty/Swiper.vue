<!--
  SwiperEmpty — Static horizontal image gallery, no touch interaction.
  Demonstrates basic linear layout with Lynx's `display: linear`.
-->
<script setup lang="ts">
import SwiperItem from '../Components/SwiperItem.vue';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(defineProps<{
  data: string[];
  itemWidth?: number;
}>(), {
  itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
});
</script>

<template>
  <view class="swiper-wrapper">
    <view class="swiper-container">
      <SwiperItem
        v-for="(pic, index) in data"
        :key="index"
        :pic="pic"
        :item-width="props.itemWidth"
      />
    </view>
  </view>
</template>

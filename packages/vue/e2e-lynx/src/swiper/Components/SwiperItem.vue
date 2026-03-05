<script setup lang="ts">
defineProps<{
  pic: string;
  itemWidth: number;
}>();
</script>

<template>
  <view :style="{ width: itemWidth + 'px', height: '100%' }">
    <image mode="aspectFill" :src="pic" :style="{ width: '100%', height: '100%' }" />
  </view>
</template>

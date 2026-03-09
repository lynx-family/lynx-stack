<script setup lang="ts">
import backIcon from '../assets/back.png';
import starIcon from '../assets/star.png';

defineProps<{
  title?: string;
}>();
</script>

<template>
  <view class="nav-bar">
    <image class="left-icon" :src="backIcon" />
    <text class="nav-title">{{ title }}</text>
    <image class="right-icon" :src="starIcon" />
  </view>
</template>

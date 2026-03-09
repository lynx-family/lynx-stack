<script setup lang="ts">
declare const SystemInfo: { platform: string };
const isIOS = typeof SystemInfo !== 'undefined' && SystemInfo.platform === 'iOS';
</script>

<template>
  <view :class="['safe-area', isIOS ? 'ios' : 'android']">
    <slot />
  </view>
</template>

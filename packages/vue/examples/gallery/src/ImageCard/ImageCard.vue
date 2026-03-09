<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  ImageCard.vue — Basic image card component.

  Displays a single picture with rounded corners (matching React Gallery).

  Tutorial step: gallery-image-card
-->
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';

defineProps<{
  picture: Picture;
}>();
</script>

<template>
  <view class="picture-wrapper">
    <image
      :style="{ width: '100%', aspectRatio: picture.width / picture.height }"
      :src="picture.src"
    />
  </view>
</template>

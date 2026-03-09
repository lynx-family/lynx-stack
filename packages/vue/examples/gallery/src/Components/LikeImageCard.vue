<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  LikeImageCard.vue — Image card with a like icon overlay.

  Combines the picture display with a LikeIcon positioned at the
  top-right corner of the card (matching React Gallery original).

  Tutorial step: gallery-like-card
-->
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';

import LikeIcon from './LikeIcon.vue';

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
    <LikeIcon />
  </view>
</template>

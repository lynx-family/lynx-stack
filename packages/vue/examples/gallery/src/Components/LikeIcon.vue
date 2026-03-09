<!-- Copyright 2026 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  LikeIcon.vue — Heart icon with tap-to-like interaction.

  Tapping the heart toggles from white to red (one-way, matching React).
  Uses PNG images and ripple circle animation.

  Tutorial step: gallery-like-card
-->
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

import redHeart from '../Pictures/redHeart.png';
import whiteHeart from '../Pictures/whiteHeart.png';

const isLiked = ref(false);

function onTap() {
  isLiked.value = true;
}
</script>

<template>
  <view class="like-icon" @tap="onTap">
    <view v-if="isLiked" class="circle" />
    <view v-if="isLiked" class="circle circleAfter" />
    <image :src="isLiked ? redHeart : whiteHeart" class="heart-love" />
  </view>
</template>

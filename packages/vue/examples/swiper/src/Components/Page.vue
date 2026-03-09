<script setup lang="ts">
import favoriteIcon from '../assets/heart.png';
import SafeArea from './SafeArea.vue';
</script>

<template>
  <SafeArea>
    <view class="page-container">
      <slot />
      <view class="card-detail-container">
        <view class="card-detail">
          <view class="card-detail-title">
            <text class="card-detail-title-price">￥1314</text>
            <text class="card-detail-amount">Sold 1000+</text>
          </view>
          <view class="card-detail-desc">
            <text class="card-detail-desc-text">Single leather seat</text>
            <image
              mode="aspectFill"
              class="favorite-icon"
              :src="favoriteIcon"
              :style="{ width: '20px', height: '20px' }"
            />
          </view>
        </view>
      </view>
      <view class="order-button">
        <text class="order-text">Order Now</text>
      </view>
    </view>
  </SafeArea>
</template>

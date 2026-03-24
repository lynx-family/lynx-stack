<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  ScrollDemo.vue — <scroll-view> + main-thread scroll worklet test

  Uses a real <scroll-view> so scroll events actually fire.
  Three worklet handlers give clear visual feedback:
    bindscrolltouchstart  → indicator turns blue  (finger down / scroll begins)
    bindscrolltouchend    → indicator turns green (finger up  / scroll ends)
    bindscroll            → indicator shows live scrollTop value

  The indicator element is accessed via :main-thread-ref so the worklets can
  mutate it directly on the Main Thread with zero thread crossings.
-->

<script main-thread lang="ts">
export function onScrollStart(event: any): void {
  // Finger touched the scroll-view — highlight the indicator immediately.
  event.currentTarget.setStyleProperty('background-color', '#0055ff')
  event.currentTarget.setStyleProperty('opacity', '1')
}

export function onScrollEnd(event: any): void {
  // Finger lifted — show settled state.
  event.currentTarget.setStyleProperty('background-color', '#00aa55')
  event.currentTarget.setStyleProperty('opacity', '0.85')
}

export function onScroll(event: any): void {
  // Fires continuously during scroll — dim slightly to show motion.
  const top = event.detail?.scrollTop ?? 0
  const opacity = String(Math.max(0.5, 1 - top / 800))
  event.currentTarget.setStyleProperty('opacity', opacity)
}
</script>

<script setup lang="ts">
import { useMainThreadRef } from '@lynx-js/vue-runtime'

// onScrollStart, onScrollEnd, onScroll injected by vue-main-thread-pre-loader
const scrollViewRef = useMainThreadRef(null)
</script>

<template>
  <view :style="{ display: 'flex', flexDirection: 'column' }">
    <!-- Status indicator — worklets read/write this element via main-thread-ref -->
    <view
      :style="{
        padding: 10,
        backgroundColor: '#888',
        borderRadius: 6,
        marginBottom: 8,
        alignItems: 'center',
      }"
    >
      <text :style="{ color: '#fff', fontSize: 13 }">
        Scroll status (watch colour)
      </text>
    </view>

    <!-- scroll-view: the actual scrollable container -->
    <scroll-view
      :main-thread-ref="scrollViewRef"
      :main-thread-bindbindscrolltouchstart="onScrollStart"
      :main-thread-bindbindscrolltouchend="onScrollEnd"
      :main-thread-bindscroll="onScroll"
      scroll-y
      :style="{ height: 240, backgroundColor: '#f5f5f5', borderRadius: 8 }"
    >
      <view
        v-for="n in 20"
        :key="n"
        :style="{
          padding: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#ddd',
          backgroundColor: n % 2 === 0 ? '#fff' : '#fafafa',
        }"
      >
        <text :style="{ fontSize: 14, color: '#333' }">Row {{ n }}</text>
      </view>
    </scroll-view>
  </view>
</template>

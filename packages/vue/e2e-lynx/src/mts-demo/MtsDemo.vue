<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  MtsDemo.vue — Main Thread Script scroll-tracking demo (Phase 2)

  Shows the performance difference between Main Thread and Background Thread
  event handling. Scroll the left panel — the blue MT box responds instantly
  while the orange BG box visibly lags behind due to 2 thread crossings.

  Uses the SWC worklet transform: functions annotated with 'main thread'
  are automatically extracted into worklet registrations.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

const INITIAL_Y = 400

// MainThreadRef for the MT-driven box
const mtRef = useMainThreadRef(null)

// MTS handler: runs on Main Thread — smooth, zero thread crossings.
// SWC extracts this function + registers it as a worklet automatically.
const onMTScroll = (event: { detail?: { scrollTop?: number } }) => {
  'main thread'
  const scrollTop = event.detail?.scrollTop ?? 0
  const newY = INITIAL_Y - scrollTop
  const el = (mtRef as unknown as { current?: { setStyleProperty?(k: string, v: string): void } }).current
  if (el?.setStyleProperty) {
    el.setStyleProperty('transform', `translateY(${newY}px)`)
  }
}

// BTS handler: runs on Background Thread — laggy, 2 thread crossings per event.
// Event fires on MT -> crosses to BG -> Vue reactive update -> ops buffer ->
// crosses back to MT -> PAPI applies style.
const bgY = ref(INITIAL_Y)

function onBGScroll(event: { detail?: { scrollTop?: number } }) {
  const scrollTop = event.detail?.scrollTop ?? 0
  bgY.value = INITIAL_Y - scrollTop
}
</script>

<template>
  <view :style="{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }">
    <!-- Header -->
    <view :style="{ padding: '16px 20px' }">
      <text :style="{ fontSize: 18, fontWeight: 'bold', color: '#e0e0e0' }">
        Main Thread vs Background Thread
      </text>
      <text :style="{ fontSize: 12, color: '#888', marginTop: 6 }">
        Scroll left panel — blue (MT, smooth) vs orange (BG, laggy)
      </text>
    </view>

    <view :style="{ display: 'flex', flexDirection: 'row', flex: 1 }">
      <!-- Left: Scrollable content -->
      <scroll-view
        :style="{ width: '50%', height: '100%' }"
        scroll-orientation="vertical"
        :main-thread-bindscroll="onMTScroll"
        @scroll="onBGScroll"
      >
        <view :style="{ height: 300, backgroundColor: '#16213e', display: 'flex', alignItems: 'center', justifyContent: 'center' }">
          <text :style="{ color: '#e94560', fontSize: 16 }">Scroll down</text>
        </view>
        <view :style="{ height: 250, backgroundColor: '#0f3460' }" />
        <view :style="{ height: 300, backgroundColor: '#533483' }" />
        <view :style="{ height: 250, backgroundColor: '#0f3460' }" />
        <view :style="{ height: 300, backgroundColor: '#16213e' }" />
        <view :style="{ height: 400, backgroundColor: '#533483' }" />
      </scroll-view>

      <!-- Right: Side-by-side tracking boxes -->
      <view :style="{ width: '50%', height: '100%', display: 'flex', flexDirection: 'row', justifyContent: 'center' }">
        <!-- MT box (blue) — smooth -->
        <view
          :main-thread-ref="mtRef"
          :style="{
            width: '70px', height: '70px',
            marginRight: '10px',
            backgroundColor: '#0077ff',
            borderRadius: 12,
            transform: `translateY(${INITIAL_Y}px)`,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }"
        >
          <text :style="{ color: '#fff', fontSize: 10, fontWeight: 'bold' }">MT</text>
        </view>

        <!-- BG box (orange) — laggy -->
        <view
          :style="{
            width: '70px', height: '70px',
            backgroundColor: '#e94560',
            borderRadius: 12,
            transform: `translateY(${bgY}px)`,
            display: 'flex', justifyContent: 'center', alignItems: 'center',
          }"
        >
          <text :style="{ color: '#fff', fontSize: 10, fontWeight: 'bold' }">BG</text>
        </view>
      </view>
    </view>
  </view>
</template>

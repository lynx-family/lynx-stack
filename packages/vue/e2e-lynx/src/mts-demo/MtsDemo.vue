<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  MtsDemo.vue — Main Thread Script demo

  Tests the full ops plumbing for worklet events:
    BG patchProp → SET_WORKLET_EVENT op → MT applyOps → __AddEvent(worklet)

  The <script main-thread> block is transformed by vue-main-thread-pre-loader:
    BG build  → exports become worklet context objects injected into <script setup>
    MT build  → exports become registerWorkletInternal() calls on the Lepus thread
-->
<script main-thread lang="ts">
export function onTap(event: any): void {
  // Runs on the Main Thread (Lepus) — zero thread crossings.
  // Dim the element on tap to give visual feedback.
  event.currentTarget.setStyleProperty('opacity', '0.6');
}

export function onScroll(event: any): void {
  // Scroll position arrives directly on the Main Thread.
  const top = (event.detail?.scrollTop ?? 0).toFixed(0);
  event.currentTarget.setStyleProperty('opacity', String(1 - Math.min(top, 100) / 200));
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

// NOTE: `onTap` and `onScroll` worklet context objects are injected here
// by vue-main-thread-pre-loader at build time.  They look like:
//   const onTap = { _wkltId: 'src/mts-demo/MtsDemo.vue:onTap', _closure: {} }

// MainThreadRef for element reference
const boxRef = useMainThreadRef(null)

// Regular BG-thread reactive state (to verify no regression)
const tapCount = ref(0)

function onBgTap() {
  tapCount.value++
}
</script>

<template>
  <view :style="{ display: 'flex', flexDirection: 'column', padding: 16 }">
    <text :style="{ fontSize: 18, color: '#333', marginBottom: 12 }">
      MTS Demo
    </text>

    <!-- Worklet event binding via :main-thread-bindtap -->
    <view
      :main-thread-bindtap="onTap"
      :main-thread-ref="boxRef"
      :style="{
        padding: 16,
        backgroundColor: '#0077ff',
        borderRadius: 8,
        marginBottom: 8,
      }"
    >
      <text :style="{ color: '#fff', fontSize: 14 }">
        MT Tap (worklet event)
      </text>
    </view>

    <!-- Worklet scroll binding -->
    <view
      :main-thread-bindscroll="onScroll"
      :style="{
        padding: 16,
        backgroundColor: '#00aa55',
        borderRadius: 8,
        marginBottom: 8,
      }"
    >
      <text :style="{ color: '#fff', fontSize: 14 }">
        MT Scroll (worklet event)
      </text>
    </view>

    <!-- Regular BG-thread tap for comparison / regression check -->
    <view
      :style="{
        padding: 16,
        backgroundColor: tapCount > 3 ? '#ff4400' : '#666',
        borderRadius: 8,
      }"
      @tap="onBgTap"
    >
      <text :style="{ color: '#fff', fontSize: 14 }">
        BG Tap: {{ tapCount }}
      </text>
    </view>
  </view>
</template>

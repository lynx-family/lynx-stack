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
const COLORS = ['#0077ff', '#ff4400', '#00aa44', '#aa00ff', '#ff9900'];
let colorIndex = 0;

export function onTap(event: any): void {
  // Runs on the Main Thread (Lepus) — zero thread crossings.
  // Cycle through colours on each tap.
  colorIndex = (colorIndex + 1) % COLORS.length;
  event.currentTarget.setStyleProperty('background-color', COLORS[colorIndex]);
}
</script>

<script setup lang="ts">
import { ref } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

// NOTE: `onTap` worklet context object is injected here by vue-main-thread-pre-loader
// at build time.  It looks like:
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
  <scroll-view :scroll-y="true" :style="{ display: 'flex', flexDirection: 'column', padding: 16 }">
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
      <text :style="{ color: '#fff', fontSize: 14, fontWeight: 'bold' }">
        Main Thread (Worklet Event)
      </text>
      <text :style="{ color: '#fff', fontSize: 12, marginTop: 4 }">
        Tap to cycle colour — runs on MT, no BG crossing
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
      <text :style="{ color: '#fff', fontSize: 14, fontWeight: 'bold' }">
        Background Thread (Regular Event)
      </text>
      <text :style="{ color: '#fff', fontSize: 12, marginTop: 4 }">
        Tap count: {{ tapCount }}
      </text>
    </view>
  </scroll-view>
</template>

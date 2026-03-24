<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  HBundleDemo.vue — minimal <script main-thread> preloader pipeline test

  Simpler than MtsDemo: single tap handler, single element, no scroll.
  The <script main-thread> block is transformed by vue-main-thread-pre-loader:
    BG build  → onTap becomes a worklet ctx object injected into <script setup>
    MT build  → onTap becomes a registerWorkletInternal() call on Lepus
-->

<script main-thread lang="ts">
export function onTap(event: any): void {
  // Executes on the Main Thread — direct PAPI access, no thread crossing.
  event.currentTarget.setStyleProperty('background-color', '#aa00ff')
  event.currentTarget.setStyleProperty('opacity', '0.7')
}
</script>

<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

// NOTE: `onTap` worklet context object is injected here by
// vue-main-thread-pre-loader at build time:
//   const onTap = { _wkltId: 'src/h-bundle-demo/HBundleDemo.vue:onTap', _closure: {} }

const boxRef = useMainThreadRef(null)
const bgCount = ref(0)
</script>

<template>
  <view :style="{ display: 'flex', flexDirection: 'column', padding: 16 }">
    <text :style="{ fontSize: 18, color: '#333', marginBottom: 12 }">
      H-Bundle Demo
    </text>

    <!-- Worklet tap — onTap ctx injected by preloader -->
    <view
      :main-thread-bindtap="onTap"
      :main-thread-ref="boxRef"
      :style="{ padding: 16, backgroundColor: '#7700ff', borderRadius: 8, marginBottom: 8 }"
    >
      <text :style="{ color: '#fff', fontSize: 14 }">MT Tap (worklet)</text>
    </view>

    <!-- Regular BG tap to verify no regression -->
    <view
      :style="{ padding: 16, backgroundColor: bgCount > 3 ? '#ff4400' : '#555', borderRadius: 8 }"
      @tap="bgCount++"
    >
      <text :style="{ color: '#fff', fontSize: 14 }">BG Tap: {{ bgCount }}</text>
    </view>
  </view>
</template>

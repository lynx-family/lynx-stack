<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  MtsDemo.vue — Phase 1 Main Thread Script demo

  Replicates the React MTS example: tap the box → it rotates 360°
  (animation runs entirely on the Main Thread, zero thread crossings).

  Phase 1: worklet context objects are hand-crafted (no SWC transform).
  The _wkltId values must match registerWorkletInternal calls in entry-main.ts.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

// Hand-crafted worklet context — simulates what the SWC transform would
// produce from a `<script main-thread>` block.
// _wkltId MUST match the registerWorkletInternal call in entry-main.ts.
const onTapCtx = {
  _wkltId: 'mts-demo:onTap',
  _workletType: 'main-thread',
  _c: {},
}

const onScrollCtx = {
  _wkltId: 'mts-demo:onScroll',
  _workletType: 'main-thread',
  _c: {},
}

// MainThreadRef for element reference
const boxRef = useMainThreadRef(null)

// Regular BG-thread reactive state (to verify no regression)
const tapCount = ref(0)

function onBgTap() {
  tapCount.value++
}
</script>

<template>
  <view :style="{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }">
    <text :style="{ fontSize: 20, color: '#333', marginBottom: 16 }">
      Vue × Lynx MTS Demo
    </text>
    <text :style="{ fontSize: 12, color: '#999', marginBottom: 20 }">
      Tap the blue box — animation runs on Main Thread
    </text>

    <!-- Worklet event: tap → rotate 360° on Main Thread (zero thread crossings) -->
    <view
      :main-thread-bindtap="onTapCtx"
      :main-thread-ref="boxRef"
      :style="{
        width: 120,
        height: 120,
        backgroundColor: '#0077ff',
        borderRadius: 16,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
      }"
    >
      <text :style="{ color: '#fff', fontSize: 16, fontWeight: 'bold' }">
        Tap me
      </text>
    </view>

    <!-- Regular BG-thread tap for comparison / regression check -->
    <view
      :style="{
        padding: '12px 24px',
        backgroundColor: tapCount > 3 ? '#ff4400' : '#666',
        borderRadius: 8,
      }"
      @tap="onBgTap"
    >
      <text :style="{ color: '#fff', fontSize: 14 }">
        BG Tap count: {{ tapCount }}
      </text>
    </view>
  </view>
</template>

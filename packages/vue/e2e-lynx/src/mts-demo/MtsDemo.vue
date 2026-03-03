<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  MtsDemo.vue — Phase 1 Main Thread Script demo

  Tests the full ops plumbing for worklet events:
    BG patchProp → SET_WORKLET_EVENT op → MT applyOps → __AddEvent(worklet)

  Since Phase 1 has no SWC transform, the worklet context objects are
  hand-crafted to simulate what the compiler would produce.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

// Hand-crafted worklet context — simulates what the SWC transform would
// produce from a `<script main-thread>` block.
const onTapCtx = {
  _wkltId: 'mts-demo:onTap',
  _closure: {},
}

const onScrollCtx = {
  _wkltId: 'mts-demo:onScroll',
  _closure: {},
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
  <view :style="{ display: 'flex', flexDirection: 'column', padding: 16 }">
    <text :style="{ fontSize: 18, color: '#333', marginBottom: 12 }">
      MTS Demo (Phase 1)
    </text>

    <!-- Worklet event binding via :main-thread-bindtap -->
    <view
      :main-thread-bindtap="onTapCtx"
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
      :main-thread-bindscroll="onScrollCtx"
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

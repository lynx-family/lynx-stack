<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  MTS Draggable Demo (Raw) — raw worklet context objects, no SWC transform.

  Left half: scroll-view with large colored blocks
  Right half: two boxes that track scroll position (start at y=500, move up)
    - MTDraggable: updated directly on Main Thread via setStyleProperty (smooth)
    - BGDraggable: updated via Background Thread reactive state (laggy)

  Requires matching registerWorkletInternal() calls in entry-main.ts.
  See mts-draggable/ for the transform-based version using 'main thread' directive.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

import MainThreadDraggable from './MainThreadDraggable.vue'
import BackgroundDraggable from './BackgroundDraggable.vue'

const DEFAULT_X = 0
const DEFAULT_Y = 500

// --- Main Thread Scroll Handler (worklet context) ---
const onMTScrollCtx = {
  _wkltId: 'mts-draggable-raw:onScroll',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
}

// MainThreadRef for the MT draggable box
const mtDraggableRef = useMainThreadRef(null)

// Stamp the ref's _wvid into the worklet context so the MT handler
// can resolve it via lynxWorkletImpl._refImpl._workletRefMap
onMTScrollCtx._c = { _mtRef: mtDraggableRef.toJSON() }

// --- Background Thread Scroll Handler ---
const bgPosX = ref(DEFAULT_X)
const bgPosY = ref(DEFAULT_Y)

function onBGScroll(event: { detail?: { scrollTop?: number } }) {
  const scrollTop = event.detail?.scrollTop ?? 0
  bgPosX.value = DEFAULT_X
  bgPosY.value = DEFAULT_Y - scrollTop
}
</script>

<template>
  <view :style="{ width: '100%', height: '100%', position: 'relative', backgroundColor: 'white' }">
    <view :style="{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }">
      <!-- Left half: Scroll View -->
      <scroll-view
        :style="{ width: '50%', height: '100%' }"
        scroll-orientation="vertical"
        :main-thread-bindscroll="onMTScrollCtx"
        @scroll="onBGScroll"
      >
        <view :style="{ backgroundColor: 'yellow', width: '100%', height: 500 }" />
        <view :style="{ backgroundColor: 'lightskyblue', width: '100%', height: 100 }" />
        <view :style="{ backgroundColor: 'yellow', width: '100%', height: 1000 }" />
      </scroll-view>

      <!-- Right half: Draggable boxes -->
      <view :style="{ width: '50%', height: '100%', display: 'flex', flexDirection: 'row' }">
        <MainThreadDraggable :size="100" :mt-ref="mtDraggableRef" />
        <BackgroundDraggable :size="100" :pos-x="bgPosX" :pos-y="bgPosY" />
      </view>
    </view>
  </view>
</template>

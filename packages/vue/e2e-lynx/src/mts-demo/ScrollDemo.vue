<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<script main-thread lang="ts">
// MT worklet — runs on Lepus, zero bridge crossings.
// Scroll-view bg turns blue while scrolling, green when settled.
export function onMtScroll(event: any): void {
  event.currentTarget.setStyleProperty('background-color', '#0055ff')
}
export function onMtScrollEnd(event: any): void {
  event.currentTarget.setStyleProperty('background-color', '#00aa55')
}
</script>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMainThreadRef } from '@lynx-js/vue-runtime'

const scrollViewRef = useMainThreadRef(null)

// BG-thread scroll tracking via Vue reactivity (confirmed working).
const scrollTop = ref(0)
const debugColor = computed(() => {
  if (scrollTop.value < 5) return '#888'
  return scrollTop.value > 250 ? '#ff8800' : '#0055ff'
})

function onBgScroll(e: any) {
  scrollTop.value = Math.round(e.detail?.scrollTop ?? 0)
}
</script>

<template>
  <view :style="{ display: 'flex', flexDirection: 'column' }">
    <!-- Scroll-view bg = MT worklet target (blue while scrolling, green settled).
         Transparent rows let the bg colour show through. -->
    <scroll-view
      :main-thread-ref="scrollViewRef"
      :main-thread-bindscroll="onMtScroll"
      :main-thread-bindscrollend="onMtScrollEnd"
      :scroll-y="true"
      @scroll="onBgScroll"
      :style="{ height: 240, backgroundColor: '#888', borderRadius: 8, marginBottom: 8 }"
    >
      <view
        v-for="n in 20"
        :key="n"
        :style="{ padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.2)' }"
      >
        <text :style="{ fontSize: 14, color: '#fff' }">Row {{ n }}</text>
      </view>
    </scroll-view>

    <!-- BG debug panel — colour + text driven by Vue reactivity.
         Changes = BG scroll events fire. Scroll-view bg not changing = MT worklets pending. -->
    <view :style="{ padding: 10, backgroundColor: debugColor, borderRadius: 6 }">
      <text :style="{ color: '#fff', fontSize: 13 }">BG scrollTop: {{ scrollTop }}px</text>
    </view>
  </view>
</template>

<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  Counter.vue — SFC sub-component
  Exercises: script setup, defineProps, defineEmits, ref, v-if, v-show, @tap
-->
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ initialCount?: number }>()
const emit = defineEmits<{ increment: [value: number] }>()

const count = ref(props.initialCount ?? 0)
const showDetail = ref(true)

function onTap() {
  count.value++
  emit('increment', count.value)
}

function onToggle() {
  showDetail.value = !showDetail.value
}
</script>

<template>
  <view :style="{ display: 'flex', flexDirection: 'column', padding: 12 }">
    <!-- v-if / v-else -->
    <text v-if="count === 0" :style="{ color: '#999', fontSize: 14 }">
      No taps yet
    </text>
    <text v-else :style="{ fontSize: 22, color: '#222' }">
      Count: {{ count }}
    </text>

    <!-- v-show -->
    <text v-show="showDetail" :style="{ color: '#666', fontSize: 12, marginTop: 4 }">
      (tap the button to increment)
    </text>

    <!-- @tap event, dynamic :style -->
    <view
      :style="{
        marginTop: 10,
        padding: '8px 16px',
        backgroundColor: count > 5 ? '#ff4400' : '#0077ff',
        borderRadius: 8,
      }"
      @tap="onTap"
    >
      <text :style="{ color: '#fff' }">Tap to increment</text>
    </view>

    <!-- toggle detail visibility -->
    <view
      :style="{ marginTop: 6, padding: '4px 12px', backgroundColor: '#eee', borderRadius: 6 }"
      @tap="onToggle"
    >
      <text :style="{ color: '#555', fontSize: 12 }">
        {{ showDetail ? 'Hide' : 'Show' }} detail
      </text>
    </view>
  </view>
</template>

<!-- Copyright 2025 The Lynx Authors. All rights reserved.
     Licensed under the Apache License Version 2.0 that can be found in the
     LICENSE file in the root directory of this source tree. -->

<!--
  App.vue — SFC root component
  Exercises: interpolation, v-for, dynamic :style/:class, child component, script setup
-->
<script setup lang="ts">
import { ref } from 'vue'
import Counter from './Counter.vue'

const title = ref('Vue 3 × Lynx — SFC Demo')
const history = ref<number[]>([])

function onCounterIncrement(value: number) {
  history.value.push(value)
  // Keep only last 5 entries
  if (history.value.length > 5) history.value.shift()
}
</script>

<template>
  <view :style="{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#f5f5f5' }">
    <!-- interpolation + dynamic style -->
    <text :style="{ fontSize: 18, fontWeight: 'bold', margin: 16, color: '#111' }">
      {{ title }}
    </text>

    <!-- child component with props and event -->
    <Counter :initial-count="0" @increment="onCounterIncrement" />

    <!-- v-for list rendering -->
    <view v-if="history.length > 0" :style="{ margin: '0 16px' }">
      <text :style="{ fontSize: 13, color: '#555', marginBottom: 4 }">History:</text>
      <view
        v-for="(val, idx) in history"
        :key="idx"
        :style="{
          padding: '2px 8px',
          marginBottom: 2,
          backgroundColor: '#fff',
          borderRadius: 4,
        }"
      >
        <text :style="{ fontSize: 12, color: '#333' }">#{{ idx + 1 }}: {{ val }}</text>
      </view>
    </view>
  </view>
</template>

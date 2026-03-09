<script setup lang="ts">
defineProps<{
  total: number;
  current: number;
}>();

const emit = defineEmits<{
  'item-click': [index: number];
}>();
</script>

<template>
  <view class="indicator">
    <view
      v-for="(_, index) in total"
      :key="index"
      :class="['indicator-item', index === current ? 'active' : '']"
      @tap="emit('item-click', index)"
    />
  </view>
</template>

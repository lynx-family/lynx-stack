<script setup>
defineProps(['activeCount', 'completedCount', 'currentFilter'])
const emit = defineEmits(['set-filter', 'clear-completed'])

function onAll() { emit('set-filter', 'all') }
function onActive() { emit('set-filter', 'active') }
function onCompleted() { emit('set-filter', 'completed') }
function onClear() { emit('clear-completed') }
</script>

<template>
  <view class="footer">
    <view :style="{ flexDirection: 'row' }">
      <text class="todo-count-number">{{ activeCount }}</text>
      <text class="todo-count"> {{ activeCount === 1 ? 'item' : 'items' }} left</text>
    </view>

    <view class="filters">
      <text
        class="filter-btn"
        :class="{ selected: currentFilter === 'all' }"
        @tap="onAll"
      >All</text>
      <text
        class="filter-btn"
        :class="{ selected: currentFilter === 'active' }"
        @tap="onActive"
      >Active</text>
      <text
        class="filter-btn"
        :class="{ selected: currentFilter === 'completed' }"
        @tap="onCompleted"
      >Completed</text>
    </view>

    <text
      v-if="completedCount > 0"
      class="clear-completed"
      @tap="onClear"
    >Clear completed</text>
  </view>
</template>

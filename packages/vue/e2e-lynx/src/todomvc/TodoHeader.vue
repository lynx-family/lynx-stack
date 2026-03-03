<script setup>
const emit = defineEmits(['add-todo'])

function onConfirm(e) {
  const value = e?.detail?.value ?? ''
  if (value.trim()) {
    emit('add-todo', value)
  }
}
</script>

<template>
  <view class="header">
    <text class="title">todos</text>
    <input
      class="new-todo"
      type="text"
      placeholder="What needs to be done?"
      confirm-type="done"
      @confirm="onConfirm"
    />
  </view>
</template>

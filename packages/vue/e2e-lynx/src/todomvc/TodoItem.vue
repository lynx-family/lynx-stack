<script setup>
import { ref } from 'vue'

const props = defineProps(['todo'])
const emit = defineEmits(['toggle', 'delete', 'edit'])

const editing = ref(false)

function onToggle() {
  emit('toggle', props.todo)
}

function onDelete() {
  emit('delete', props.todo)
}

function startEdit() {
  editing.value = true
}

function onEditConfirm(e) {
  const value = e?.detail?.value ?? ''
  editing.value = false
  emit('edit', props.todo, value)
}

function cancelEdit() {
  editing.value = false
}
</script>

<template>
  <!-- Normal view -->
  <view
    v-if="!editing"
    class="todo-item"
    :class="{ completed: todo.completed }"
  >
    <view class="todo-toggle" @tap="onToggle">
      <text v-if="todo.completed" class="checkmark">✓</text>
    </view>
    <text class="todo-label" @longpress="startEdit">{{ todo.title }}</text>
    <text class="destroy" @tap="onDelete">✕</text>
  </view>

  <!-- Edit view -->
  <view v-else class="edit-container">
    <input
      class="edit-input"
      type="text"
      :value="todo.title"
      @confirm="onEditConfirm"
      @blur="cancelEdit"
    />
  </view>
</template>

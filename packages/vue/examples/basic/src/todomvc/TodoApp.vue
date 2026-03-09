<script setup>
import { ref, computed } from 'vue'

import TodoHeader from './TodoHeader.vue'
import TodoItem from './TodoItem.vue'
import TodoFooter from './TodoFooter.vue'

// ── State ──────────────────────────────────────────────────
const todos = ref([])
const filter = ref('all')

// ── Derived ────────────────────────────────────────────────
const activeTodos = computed(() => todos.value.filter(t => !t.completed))
const completedTodos = computed(() => todos.value.filter(t => t.completed))
const filteredTodos = computed(() => {
  if (filter.value === 'active') return activeTodos.value
  if (filter.value === 'completed') return completedTodos.value
  return todos.value
})
const allCompleted = computed(() =>
  todos.value.length > 0 && activeTodos.value.length === 0,
)

// ── Helpers ────────────────────────────────────────────────
let nextId = 0
function uuid() {
  return `todo-${++nextId}`
}

// ── Actions ────────────────────────────────────────────────
function addTodo(title) {
  if (!title.trim()) return
  todos.value.push({ id: uuid(), title: title.trim(), completed: false })
}

function toggleTodo(todo) {
  todo.completed = !todo.completed
}

function deleteTodo(todo) {
  todos.value = todos.value.filter(t => t.id !== todo.id)
}

function editTodo(todo, newTitle) {
  if (!newTitle.trim()) {
    deleteTodo(todo)
    return
  }
  todo.title = newTitle.trim()
}

function toggleAll() {
  const newVal = !allCompleted.value
  todos.value.forEach(t => { t.completed = newVal })
}

function clearCompleted() {
  todos.value = todos.value.filter(t => !t.completed)
}

function setFilter(f) {
  filter.value = f
}
</script>

<template>
  <view class="todoapp">
    <TodoHeader @add-todo="addTodo" />

    <view class="main" v-if="todos.length > 0">
      <!-- Toggle all -->
      <view class="toggle-all-container">
        <view
          class="toggle-all-btn"
          :class="{ 'all-completed': allCompleted }"
          @tap="toggleAll"
        >
          <text class="toggle-all-icon">✓</text>
        </view>
        <text class="toggle-all-label">Mark all as complete</text>
      </view>

      <!-- Todo list -->
      <view class="todo-list">
        <TodoItem
          v-for="todo in filteredTodos"
          :key="todo.id"
          :todo="todo"
          @toggle="toggleTodo"
          @delete="deleteTodo"
          @edit="editTodo"
        />
      </view>
    </view>

    <TodoFooter
      v-if="todos.length > 0"
      :active-count="activeTodos.length"
      :completed-count="completedTodos.length"
      :current-filter="filter"
      @set-filter="setFilter"
      @clear-completed="clearCompleted"
    />

    <!-- Info -->
    <view class="info">
      <text class="info-text">Tap a todo circle to toggle</text>
      <text class="info-text">Built with Vue 3 × Lynx</text>
    </view>
  </view>
</template>

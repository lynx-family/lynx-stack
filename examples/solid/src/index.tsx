import { For, Show, createMemo, createSignal, root } from '@lynx-js/solid';
import type { Accessor, JSX } from '@lynx-js/solid';

interface Todo {
  done: boolean;
  id: number;
  title: string;
}

const initialTodos: Todo[] = [
  { id: 1, title: 'Review Element Template output', done: true },
  { id: 2, title: 'Verify background updates', done: false },
  { id: 3, title: 'Polish the SolidLynx demo', done: false },
];

const suggestedTodos = [
  'Run the focused test suite',
  'Inspect the generated bundle',
  'Check the first-frame render',
];

function TodoRow(props: {
  index: Accessor<number>;
  onRemove: (id: number) => void;
  onToggle: (id: number) => void;
  todo: Todo;
}): JSX.Element {
  return (
    <view class={`todo-row ${props.todo.done ? 'todo-row-done' : ''}`}>
      <view
        class={`check ${props.todo.done ? 'check-done' : ''}`}
        bindtap={() => props.onToggle(props.todo.id)}
      >
        <text class='check-label'>{props.todo.done ? 'OK' : ''}</text>
      </view>
      <view class='todo-copy'>
        <text class='todo-index'>{props.index() + 1}</text>
        <text
          class={`todo-title ${props.todo.done ? 'todo-title-done' : ''}`}
        >
          {props.todo.title}
        </text>
      </view>
      <view
        class='remove-button'
        bindtap={() => props.onRemove(props.todo.id)}
      >
        <text class='remove-label'>Remove</text>
      </view>
    </view>
  );
}

export function App(): JSX.Element {
  const [todos, setTodos] = createSignal<Todo[]>(initialTodos);
  const completedCount = createMemo(
    () => todos().filter(todo => todo.done).length,
  );
  const remainingCount = createMemo(
    () => todos().length - completedCount(),
  );
  let nextId = initialTodos.length + 1;

  const addTodo = (): void => {
    const title = suggestedTodos[
      (nextId - initialTodos.length - 1) % suggestedTodos.length
    ]!;
    const todo = { id: nextId++, title, done: false };
    setTodos(items => [...items, todo]);
  };

  const toggleTodo = (id: number): void => {
    setTodos(items =>
      items.map(todo => todo.id === id ? { ...todo, done: !todo.done } : todo)
    );
  };

  const removeTodo = (id: number): void => {
    setTodos(items => items.filter(todo => todo.id !== id));
  };

  const clearCompleted = (): void => {
    setTodos(items => items.filter(todo => !todo.done));
  };

  return (
    <view class='page'>
      <view class='workspace'>
        <view class='header'>
          <view>
            <text class='eyebrow'>SOLIDLYNX</text>
            <text class='title'>Today</text>
          </view>
          <view class='add-button' bindtap={addTodo}>
            <text class='add-label'>+ Add task</text>
          </view>
        </view>

        <view class='summary'>
          <text class='summary-number'>{remainingCount()}</text>
          <text class='summary-label'>tasks remaining</text>
          <text class='summary-divider'>/</text>
          <text class='summary-muted'>{completedCount()} completed</text>
        </view>

        <view class='todo-list'>
          <Show
            when={todos().length > 0}
            fallback={
              <view class='empty-state'>
                <text class='empty-title'>All clear</text>
                <text class='empty-copy'>Add a task to start a new list.</text>
              </view>
            }
          >
            <For each={todos()}>
              {(todo, index) => (
                <TodoRow
                  todo={todo}
                  index={index}
                  onToggle={toggleTodo}
                  onRemove={removeTodo}
                />
              )}
            </For>
          </Show>
        </view>

        <Show when={completedCount() > 0}>
          <view class='footer'>
            <text class='footer-copy'>
              {completedCount()} of {todos().length} complete
            </text>
            <view class='clear-button' bindtap={clearCompleted}>
              <text class='clear-label'>Clear completed</text>
            </view>
          </view>
        </Show>
      </view>
    </view>
  );
}

root.render(App);

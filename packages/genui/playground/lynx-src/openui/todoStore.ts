// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

interface Todo {
  id: string;
  title: string;
  done: boolean;
}

/** In-memory Todo demo data, owned by one mounted preview. */
export class TodoStore {
  private todos: Todo[] = [
    { id: 'todos-1', title: 'Build a protocol-driven demo', done: false },
    { id: 'todos-2', title: 'Review the task list', done: true },
  ];
  private nextId = 3;

  /** The Query/Mutation tools used by the Todo List DSL. */
  readonly tools = {
    'todo.list': () => ({ items: this.todos.map(todo => ({ ...todo })) }),
    'todo.add': (args: Record<string, unknown>) => {
      const title = typeof args.title === 'string' ? args.title.trim() : '';
      if (!title) throw new Error('A task title is required.');
      const todo: Todo = { id: `todos-${this.nextId++}`, title, done: false };
      this.todos.push(todo);
      return { ...todo };
    },
    'todo.remove': (args: Record<string, unknown>) => {
      const index = this.todos.findIndex(todo => todo.id === args.id);
      if (index === -1) throw new Error('Task not found.');
      const [removed] = this.todos.splice(index, 1);
      return { id: removed!.id };
    },
  };
}

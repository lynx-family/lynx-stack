// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type DestroyTask = () => void;

const destroyTasks = new Set<DestroyTask>();
let destroyed = false;

// Calls from a retired entry stay pending: settling them would run its continuations.
export function isRuntimeDestroyed(): boolean {
  return destroyed;
}

export function destroyRuntime(): void {
  destroyed = true;
  runDestroyTasks();
}

export function registerDestroyTask(task: DestroyTask): () => void {
  destroyTasks.add(task);
  return () => {
    destroyTasks.delete(task);
  };
}

export function runDestroyTasks(): void {
  const tasks = Array.from(destroyTasks);
  destroyTasks.clear();
  for (const task of tasks) {
    task();
  }
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

type DestroyTask = () => void;

export let destroyTasks: Set<DestroyTask> = new Set<DestroyTask>();

export function setDestroyTasks(tasks: Set<DestroyTask>): void {
  destroyTasks = tasks;
}

export function registerDestroyTask(task: DestroyTask): () => void {
  destroyTasks.add(task);
  return () => {
    destroyTasks.delete(task);
  };
}

export function runDestroyTasks(): void {
  const tasks = Array.from(destroyTasks);
  for (const task of tasks) {
    task();
  }
  destroyTasks.clear();
}

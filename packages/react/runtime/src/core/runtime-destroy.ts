// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getCurrentRootContext } from '../root-context.js';

type DestroyTask = () => void;

export function registerDestroyTask(task: DestroyTask): () => void {
  const destroyTasks = getCurrentRootContext().destroyTasks;
  destroyTasks.add(task);
  return () => {
    destroyTasks.delete(task);
  };
}

export function runDestroyTasks(): void {
  const destroyTasks = getCurrentRootContext().destroyTasks;
  const tasks = Array.from(destroyTasks);
  for (const task of tasks) {
    task();
  }
  destroyTasks.clear();
}

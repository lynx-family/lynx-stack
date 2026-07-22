// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { registerContextSlot } from '../root-context.js';

type DestroyTask = () => void;

let destroyTasks = new Set<DestroyTask>();

if (typeof __MULTI_PAGE__ !== 'undefined' && __MULTI_PAGE__) {
  registerContextSlot({
    id: 'destroyTasks',
    init: () => new Set<DestroyTask>(),
    save(bag) {
      bag['destroyTasks'] = destroyTasks;
    },
    load(bag) {
      destroyTasks = bag['destroyTasks'] as Set<DestroyTask>;
    },
  });
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

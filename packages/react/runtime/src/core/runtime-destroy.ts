// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { onRootContextSwitch } from '../render-context.js';

type DestroyTask = () => void;

let destroyTasks = new Set<DestroyTask>();

if (typeof __LYNX_GROUP_MODULE_SHARING__ !== 'undefined' && __LYNX_GROUP_MODULE_SHARING__) {
  onRootContextSwitch(
    (ctx) => ctx.destroyTasks = destroyTasks,
    (ctx) => destroyTasks = ctx.destroyTasks ??= new Set(),
  );
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

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference types="./prefresh.d.ts" />

import '@prefresh/core';

import { prefreshSelf } from './self.js';
import type { PrefreshCore } from './self.js';

export type RefreshType = (...args: unknown[]) => unknown;

export interface RefreshRuntime {
  sign: (
    type: unknown,
    key: string | undefined,
    forceReset?: boolean,
    getCustomHooks?: () => unknown[],
    status?: string,
  ) => string | undefined;
  register: (type: unknown, id: string) => void;
  flush: () => void;
}

const core = prefreshSelf.__PREFRESH__;
if (core && typeof globalThis !== 'undefined') {
  // Keep assigning `globalThis.__PREFRESH__` so an older
  // `@lynx-js/react-refresh-webpack-plugin` continues working in single-template mode.
  (globalThis as { __PREFRESH__?: PrefreshCore }).__PREFRESH__ = core;
}

function compareSignatures(
  runtimeCore: PrefreshCore,
  prev: RefreshType,
  next: RefreshType,
): void {
  const prevSignature = runtimeCore.getSignature(prev) ?? {};
  const nextSignature = runtimeCore.getSignature(next) ?? {};

  if (
    prevSignature.key !== nextSignature.key
    || runtimeCore.computeKey(prevSignature)
      !== runtimeCore.computeKey(nextSignature)
    || nextSignature.forceReset
  ) {
    runtimeCore.replaceComponent(prev, next, true);
  } else {
    runtimeCore.replaceComponent(prev, next, false);
  }
}

export function createRefreshRuntime(): RefreshRuntime {
  const runtimeCore = prefreshSelf.__PREFRESH__;
  if (!runtimeCore) {
    throw new Error('@lynx-js/react/refresh runtime is not initialized');
  }

  const typesById = new Map<string, RefreshType>();
  const pendingUpdates: [RefreshType, RefreshType][] = [];

  return {
    sign(type, key, forceReset, getCustomHooks, status) {
      return runtimeCore.sign(type, key, forceReset, getCustomHooks, status);
    },
    register(type, id) {
      if (typeof type !== 'function') {
        return;
      }

      const fn = type as RefreshType;
      if (typesById.has(id)) {
        const existing = typesById.get(id)!;
        if (existing !== fn) {
          pendingUpdates.push([existing, fn]);
          typesById.set(id, fn);
        }
      } else {
        typesById.set(id, fn);
      }

      if (!runtimeCore.getSignature(fn)) {
        runtimeCore.sign(fn, undefined, false, undefined, 'begin');
      }
    },
    flush() {
      const seenUpdates = new WeakMap<RefreshType, WeakSet<RefreshType>>();
      const pending = pendingUpdates.splice(0, pendingUpdates.length);

      for (const [prev, next] of pending) {
        let seenNext = seenUpdates.get(prev);
        if (seenNext?.has(next)) {
          continue;
        }
        if (!seenNext) {
          seenNext = new WeakSet();
          seenUpdates.set(prev, seenNext);
        }
        seenNext.add(next);
        compareSignatures(runtimeCore, prev, next);
      }
    },
  };
}

export { flush, isComponent } from '@prefresh/utils';

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface PrefreshSignature {
  type?: unknown;
  key?: string | undefined;
  forceReset?: boolean | undefined;
  getCustomHooks?: (() => unknown[]) | undefined;
  fullKey?: string | undefined;
}

export interface PrefreshCore {
  getSignature: (type: unknown) => PrefreshSignature | undefined;
  register: (type: unknown, id: string) => void;
  getPendingUpdates: () => [unknown, unknown][];
  flush: () => void;
  replaceComponent: (
    oldType: unknown,
    newType: unknown,
    resetHookState: boolean,
  ) => void;
  sign: (
    type: unknown,
    key: string | undefined,
    forceReset: boolean | undefined,
    getCustomHooks: (() => unknown[]) | undefined,
    status: string | undefined,
  ) => string | undefined;
  computeKey: (signature: PrefreshSignature) => string | undefined;
}

/**
 * Module-scoped `self` substitute for `@prefresh/core` and `@prefresh/utils` so
 * VNode tracking and Preact options hooks do not collide with other copies or
 * depend on `globalThis.__PREFRESH__`.
 */
export const prefreshSelf: { __PREFRESH__?: PrefreshCore } = {};

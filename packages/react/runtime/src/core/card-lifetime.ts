// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const storeKey = Symbol.for('__REACT_LYNX_CARD_LIFETIME__');

/**
 * Module-level state that survives an entry re-evaluation, for state tied to
 * native objects that outlive the entry or IDs that late messages may carry.
 */
export function cardLifetime<T extends object>(key: string, init: () => T): T {
  if (typeof __EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__ === 'undefined' || !__EXPERIMENTAL_RE_EVAL_JS_ON_RELOAD__) {
    return init();
  }
  const host = lynx as unknown as Record<symbol, Record<string, object> | undefined>;
  const store = host[storeKey] ??= {};
  return (store[key] ??= init()) as T;
}

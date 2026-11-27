// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Values that forward to an object that only exists after setup: the memfs
// of @rspack/browser. Each one looks its target up on every use, so it can be
// created, imported and passed around before setup.

type Callable = (...args: unknown[]) => unknown;

/**
 * A function that calls `owner()[key]` with `owner()` as `this`, as memfs
 * methods expect. It has the name `key`.
 */
export function forward(owner: () => object, key: string): Callable {
  const named: Record<string, Callable> = {
    [key](...args: unknown[]) {
      const target = owner();
      return Reflect.apply(Reflect.get(target, key) as Callable, target, args);
    },
  };
  return named[key]!;
}

/** A class, as far as the type of a lazy one goes. */
export type Class = new(...args: unknown[]) => object;

/**
 * A class that is `getTarget()`: calling it, `new` and its properties
 * (`prototype` among them) go to the target.
 */
export function lazyClass<T>(getTarget: () => unknown): T {
  const real = () => getTarget() as Callable;
  const proxy: object = new Proxy(function() {}, {
    apply: (_target, thisArg, args) => Reflect.apply(real(), thisArg, args),
    construct: (_target, args, newTarget) =>
      Reflect.construct(
        real(),
        args,
        newTarget === proxy ? real() : newTarget,
      ) as object,
    get: (_target, key) => Reflect.get(real(), key) as unknown,
  });
  // The Proxy stands for the class, which TypeScript cannot tell.
  return proxy as unknown as T;
}

/**
 * An object that is `getTarget()`: reads, writes and key listings go to the
 * target. Functions read from it are bound to the target.
 */
export function lazyObject<T extends object>(getTarget: () => T): T {
  const proxy = new Proxy({}, {
    get(_target, key) {
      const target = getTarget();
      const value = Reflect.get(target, key) as unknown;
      return typeof value === 'function'
        ? (value as Callable).bind(target)
        : value;
    },
    set: (_target, key, value) => Reflect.set(getTarget(), key, value),
    has: (_target, key) => Reflect.has(getTarget(), key),
    ownKeys: () => Reflect.ownKeys(getTarget()),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = Reflect.get(getTarget(), key) as unknown;
      return value === undefined
        ? undefined
        : { value, enumerable: true, configurable: true, writable: true };
    },
  });
  // The Proxy stands for the object, which TypeScript cannot tell.
  return proxy as unknown as T;
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Values that forward to an object that only exists after setup: the memfs
// of @rspack/browser. Each one looks its target up on every use, so it can be
// created, imported and passed around before setup.

type Callable = (...args: unknown[]) => unknown;

/** A class, as far as the type of a lazy one goes. */
export type Class = new(...args: unknown[]) => object;

/**
 * A function that calls `owner()[key]` with `owner()` as `this`, as memfs
 * methods expect. It has the name `key`.
 */
function forward(owner: () => object, key: string): Callable {
  const named: Record<string, Callable> = {
    [key](...args: unknown[]) {
      const target = owner();
      return Reflect.apply(Reflect.get(target, key) as Callable, target, args);
    },
  };
  return named[key]!;
}

/**
 * A class that is `getTarget()`: calling it, `new` and its properties
 * (`prototype` among them) go to the target.
 */
function lazyClass(getTarget: () => object): object {
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
  return proxy;
}

/**
 * An object that is `getTarget()`: reads, writes and key listings go to the
 * target. Functions read from it are bound to the target.
 */
function lazyObject(getTarget: () => object): object {
  return new Proxy({}, {
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
}

/**
 * An object with every key of `sample`, in its order, whose members stand for
 * the members of `target()`. `sample` and `other` are the same object (a
 * memfs `fs`, or its `promises`) of two memfs instances that exist when this
 * module loads:
 *
 * - a member that is the same in both is what memfs defines once per module
 *   (`constants`, `Stats`, ...), and is taken as it is;
 * - a method calls the method of the same name of `target()`;
 * - a class (`ReadStream`, ...) or an object (`__vol`) is a proxy of the one
 *   of `target()`.
 */
export function forwardMembers(
  sample: object,
  other: object,
  target: () => object,
): Record<string, unknown> {
  const member = (key: string) => () => Reflect.get(target(), key) as object;
  return Object.fromEntries(
    Object.keys(sample).map((key) => {
      const value = Reflect.get(sample, key) as unknown;
      if (value === Reflect.get(other, key)) return [key, value];
      if (typeof value !== 'function') return [key, lazyObject(member(key))];
      if (/^[A-Z]/.test(key)) return [key, lazyClass(member(key))];
      return [key, forward(target, key)];
    }),
  );
}

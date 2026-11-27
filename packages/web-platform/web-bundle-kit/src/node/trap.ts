// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// A Node.js built-in that has no browser equivalent. Importing it is fine;
// using it throws an error that names it.
//
// Every property is a member: a function Proxy that throws when it is called
// or constructed, and whose properties are members again. It has a
// `prototype`, so `class X extends Readable` still loads.

/** A member of a trapped built-in. Calling it or `new` throws. */
export interface TrapMember {
  (...args: unknown[]): never;
  new(...args: unknown[]): never;
  readonly [key: string]: TrapMember;
}

/**
 * A trapped built-in: every key of `Module` (the Node.js module's type) is a
 * member, and so is any other key.
 */
export type TrapModule<Module> =
  & TrapMember
  & { readonly [K in keyof Module]-?: TrapMember };

function unsupported(name: string, what: string): never {
  const error = new Error(
    `${name}.${what} is not available in @lynx-js/web-bundle-kit (a browser build)`,
  ) as Error & { code: string };
  error.code = 'ERR_WEB_BUNDLE_KIT_UNSUPPORTED';
  throw error;
}

function member(name: string, path: string): TrapMember {
  const proxy = new Proxy(function() {}, {
    apply: () => unsupported(name, `${path}()`),
    construct: () => unsupported(name, `new ${path}()`),
    get: (_target, key) => {
      if (key === 'prototype') return {};
      if (typeof key === 'symbol') return undefined;
      return member(name, `${path}.${key}`);
    },
  });
  // The Proxy behaves as a TrapMember, which TypeScript cannot tell.
  return proxy as unknown as TrapMember;
}

/**
 * The module value of trapped built-in `name` (`node:zlib`, say). Reading the
 * same key twice gives the same member, so the named exports of a stand-in,
 * read from this value, are the members its default export has.
 */
export function trap<Module>(name: string): TrapModule<Module> {
  const members = new Map<string, TrapMember>();
  const proxy = new Proxy(function() {}, {
    get(_target, key) {
      // What CommonJS interop helpers look for: this is not an ES module
      // namespace, and its default is itself.
      if (key === '__esModule') return false;
      if (key === 'default') return proxy;
      // Not a thenable, so `await import()` of it does not call `then`.
      if (typeof key === 'symbol' || key === 'then') return undefined;
      let value = members.get(key);
      if (!value) {
        value = member(name, key);
        members.set(key, value);
      }
      return value;
    },
    apply: () => unsupported(name, '()'),
  });
  // The Proxy behaves as a TrapModule, which TypeScript cannot tell.
  return proxy as unknown as TrapModule<Module>;
}

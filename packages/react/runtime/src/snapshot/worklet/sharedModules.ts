// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The main-thread registry of `runtime: 'shared'` modules when
 * `enableMTSRendering: false`. Worklet definitions assembled into the
 * main-thread chunk are detached from any module graph, so a shared import
 * referenced inside them cannot resolve as a module binding. Instead the
 * bundler compiles each shared module into the main-thread layer behind a
 * wrapper that registers its namespace here under a build-stable id, and the
 * assembled definitions look the namespace up at worklet invocation time.
 *
 * The registry lives behind a global symbol rather than in this module's
 * scope: the registering wrappers are virtual modules the bundler synthesizes
 * outside any importable location, so the global is the one place both sides
 * can reach — the same pattern the assembled definitions already use for the
 * runtime handle.
 */

const REGISTRY = /* @__PURE__ */ Symbol.for('__REACT_LYNX_SHARED_MODULES__');

function registry(): Map<string, unknown> {
  const global = globalThis as { [REGISTRY]?: Map<string, unknown> };
  return global[REGISTRY] ??= new Map();
}

/**
 * Registers the namespace of a `runtime: 'shared'` module compiled into the
 * main-thread layer.
 *
 * @internal
 */
export function registerSharedModule(id: string, namespace: unknown): void {
  registry().set(id, namespace);
}

/**
 * Looks up the namespace of a registered `runtime: 'shared'` module. Called
 * by assembled worklet definitions at invocation time.
 *
 * @internal
 */
export function getSharedModule(id: string): unknown {
  const modules = registry();
  if (!modules.has(id)) {
    throw new Error(
      `A main-thread function referenced the shared module "${id}", but no such module is registered.`,
    );
  }
  return modules.get(id);
}

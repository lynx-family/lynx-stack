// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const sRuntimeVersion: symbol = Symbol.for('__REACT_LYNX_RUNTIME_VERSION__');

function getTarget(): typeof globalThis & Record<symbol, unknown> {
  return (__LEPUS__ ? globalThis : lynx) as typeof globalThis & Record<symbol, unknown>;
}

/**
 * Record the `@lynx-js/react` runtime version compiled into this bundle.
 *
 * Every lazy bundle bundles its own copy of the `@lynx-js/react` runtime. The
 * host template is loaded first, so the first registration wins and the
 * recorded value reflects the host's runtime version. This function only
 * records the version so it is available for later inspection; it does not
 * compare versions or throw.
 */
export function registerRuntimeVersion(version: string | undefined): void {
  // Older versions of the build plugin do not stamp `__RUNTIME_VERSION__`, so
  // there is nothing to record.
  if (!version) {
    return;
  }

  const target = getTarget();
  const currentVersion = target[sRuntimeVersion] as string | undefined;

  // Log host and bundle versions so online reports can diagnose mismatches.
  // Only emit on the background thread — the main-thread copy would be a
  // duplicate report of the same values.
  // TODO: on repeated registration, compare and surface a compatibility check.
  if (__JS__) {
    console.alog?.(
      `[ReactLynx] new runtime version: ${version}${
        currentVersion === undefined ? '' : `, current version: ${currentVersion}`
      }`,
    );
  }

  // The host registers first; keep its version and let later lazy bundles be
  // no-ops so the recorded value always represents the host runtime.
  if (currentVersion !== undefined) {
    return;
  }

  Object.defineProperty(target, sRuntimeVersion, {
    value: version,
    enumerable: false,
    writable: false,
    configurable: true,
  });
}

/**
 * Read the `@lynx-js/react` runtime version recorded by the host template, or
 * `undefined` when the host was built by a plugin that does not stamp it.
 */
export function getRuntimeVersion(): string | undefined {
  return getTarget()[sRuntimeVersion] as string | undefined;
}

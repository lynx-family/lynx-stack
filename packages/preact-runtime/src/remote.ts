// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Runtime support for `import(url, { with: { type: 'component' } })`.
 * The plugin rewrites such calls to `globalThis.__preactRemoteImport(url)`.
 *
 * Resolution order:
 * 1. a module registered via {@link registerRemoteModule} (keyed by the URL's
 *    trailing file name) — used by the example ports;
 * 2. fetch + evaluate as a CommonJS module, with `require` resolving modules
 *    registered via {@link registerSharedModule}.
 */

type ModuleLoader = () => Promise<unknown>;

const registry = new Map<string, ModuleLoader>();
const sharedModules = new Map<string, unknown>();

/**
 * Register a local module for a producer-bundle file name.
 *
 * @public
 */
export function registerRemoteModule(
  fileName: string,
  loader: ModuleLoader,
): void {
  registry.set(fileName, loader);
}

/** Make a module available to fetched producer bundles via `require`. */
export function registerSharedModule(name: string, value: unknown): void {
  sharedModules.set(name, value);
}

function shimRequire(specifier: string): unknown {
  if (sharedModules.has(specifier)) {
    return sharedModules.get(specifier);
  }
  throw new Error(
    `__preactRemoteImport: producer bundle requires unknown module "${specifier}"`,
  );
}

async function remoteImport(url: string): Promise<unknown> {
  const fileName = url.split('?')[0]!.split('/').pop()!;
  const registered = registry.get(fileName);
  if (registered) {
    return registered();
  }
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- worker runtime
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `__preactRemoteImport: failed to load ${url}: ${response.status}`,
    );
  }
  const source = await response.text();
  const producerModule = { exports: {} as Record<string, unknown> };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const evaluate = new Function('module', 'exports', 'require', source) as (
    module: unknown,
    exports: unknown,
    require: unknown,
  ) => void;
  evaluate(producerModule, producerModule.exports, shimRequire);
  return producerModule.exports;
}

(globalThis as Record<string, unknown>)['__preactRemoteImport'] = remoteImport;

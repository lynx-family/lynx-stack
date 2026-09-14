// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import rspack from '@rspack/core';

declare const require: (id: string) => unknown;

/**
 * Modules a test-time-compiled fixture is allowed to import, bound to the very
 * same instances the tests themselves import so the runtime stays a singleton.
 *
 * Deliberately lazy: several of these register global listeners on evaluation,
 * and some harnesses (the main-thread render fixtures) must not pull those in.
 * Loading only what a fixture actually imports keeps that side-effect surface
 * identical to importing the compiled module directly.
 */
const COMPILED_MODULE_LOADERS: Record<string, () => unknown> = {
  '@lynx-js/react': () => require('@lynx-js/react'),
  '@lynx-js/react/element-template': () => require('@lynx-js/react/element-template'),
  '@lynx-js/react/element-template/internal': () => require('@lynx-js/react/element-template/internal'),
  '@lynx-js/react/internal': () => require('@lynx-js/react/internal'),
  '@lynx-js/react/jsx-runtime': () => require('@lynx-js/react/jsx-runtime'),
  'preact': () => require('preact'),
};

/**
 * Evaluates ESM produced by the ReactLynx transform at test time.
 *
 * Such code can never be part of the bundle, and writing it to a temp file for
 * Node to `import()` — as these harnesses used to — only worked under a runner
 * that intercepts dynamic imports and applies the project's aliases. Node on
 * its own cannot resolve the artifact's bare `@lynx-js/react*` specifiers from
 * a temp directory. Lower it to CommonJS and run it in-process instead.
 */
export function evaluateCompiledModule<T extends object>(
  code: string,
  filename: string,
): T {
  const { code: cjs } = rspack.experiments.swc.transformSync(code, {
    filename,
    jsc: { parser: { syntax: 'ecmascript' }, target: 'es2022' },
    module: { type: 'commonjs' },
    isModule: true,
  });

  const module = { exports: {} as Record<string, unknown> };
  const requireCompiledModule = (id: string): unknown => {
    const load = COMPILED_MODULE_LOADERS[id];
    if (load) {
      return load();
    }
    throw new Error(
      `Compiled module "${filename}" imported "${id}", which is not in the compiled-module registry.`,
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('require', 'module', 'exports', cjs)(
    requireCompiledModule,
    module,
    module.exports,
  );

  return module.exports as unknown as T;
}

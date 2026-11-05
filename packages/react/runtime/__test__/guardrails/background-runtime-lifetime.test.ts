// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import ts from 'typescript';
import { expect, it, vi } from 'vitest';

import { transformReactLynxSync } from '@lynx-js/react-transform';

it('keeps ET background function registration on the BTS destruction path', () => {
  const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const require = createRequire(import.meta.url);
  const nativeListeners = new Map<string, (event: unknown) => void>();
  const native = {
    addEventListener: vi.fn((type: string, listener: (event: unknown) => void) => nativeListeners.set(type, listener)),
    removeEventListener: vi.fn((type: string) => nativeListeners.delete(type)),
  };
  const peer = { addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() };
  const app: { callDestroyLifetimeFun?: () => void } = {};
  const sandbox = vm.createContext({
    console,
    __DEV__: false,
    __PROFILE__: false,
    lynx: {
      getApp: () => app,
      getNative: () => native,
      getCoreContext: () => peer,
    },
  });
  vm.runInContext('globalThis.SystemInfo = { lynxSdkVersion: \'4.2\' }', sandbox);
  const modules = new Map<string, { exports: Record<string, any> }>();
  const aliases: Record<string, string> = {
    '@lynx-js/react/worklet-runtime/bindings': 'src/worklet-runtime/bindings/index.ts',
    '@lynx-js/lynx-runtime/bts': '../../lynx/lynx-runtime/src/bts.ts',
    '@lynx-js/lynx-runtime/mts': '../../lynx/lynx-runtime/src/mts.ts',
  };

  // The normal Vitest harness keeps both threads live. Evaluate the production
  // BTS transform so wrong-thread imports cannot hide behind its shared globals.
  function load(filename: string): Record<string, any> {
    const cached = modules.get(filename);
    if (cached) return cached.exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const transformed = transformReactLynxSync(fs.readFileSync(filename, 'utf8'), {
      filename,
      pluginName: '',
      mode: 'production',
      sourcemap: false,
      snapshot: false,
      elementTemplate: false,
      dynamicImport: false,
      directiveDCE: false,
      shake: false,
      compat: false,
      worklet: false,
      refresh: false,
      cssScope: false,
      defineDCE: {
        define: {
          __LEPUS__: 'false',
          __MAIN_THREAD__: 'false',
          __JS__: 'true',
          __BACKGROUND__: 'true',
          __DEV__: 'false',
          __PROFILE__: 'false',
        },
      },
    }).code;
    const code = ts.transpileModule(transformed, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    // Generated CommonJS has different line offsets from the source; keep its
    // script identity in test-utils so V8 does not merge it into source coverage.
    const execute = vm.runInContext(`(function(require, module, exports) {\n${code}\n})`, sandbox, {
      filename: path.join(runtimeRoot, '__test__/test-utils/production-bts', `${path.basename(filename)}.cjs`),
    });
    execute(
      (specifier: string) => {
        if (aliases[specifier]) return load(path.resolve(runtimeRoot, aliases[specifier]));
        if (specifier.startsWith('.')) {
          const resolved = path.resolve(path.dirname(filename), specifier);
          return load(fs.existsSync(resolved) ? resolved : resolved.replace(/\.js$/, '.ts'));
        }
        return require(specifier);
      },
      module,
      module.exports,
    );
    return module.exports;
  }

  const helper = load(
    path.join(runtimeRoot, 'src/element-template/runtime/template/main-thread-background-function.ts'),
  );
  helper.registerMainThreadBackgroundFunctionCtx({ _wkltId: 'background' });

  expect([...modules.keys()]).not.toContain(path.resolve(runtimeRoot, '../../lynx/lynx-runtime/src/mts.ts'));
  expect([...modules.keys()]).not.toContain(path.join(runtimeRoot, 'src/worklet-runtime/jsFunctionLifecycle.ts'));
  expect(native.addEventListener).not.toHaveBeenCalled();

  const { bindPage } = load(path.resolve(runtimeRoot, '../../lynx/lynx-runtime/src/bts.ts'));
  const callDestroyLifetimeFun = vi.fn();
  bindPage().onDestroy(callDestroyLifetimeFun);

  // Match BTSRuntime::Destroy's mutually exclusive Native-listener/App entry.
  const onNativeDestroy = nativeListeners.get('__DestroyLifetime');
  if (onNativeDestroy) onNativeDestroy({ type: '__DestroyLifetime' });
  else app.callDestroyLifetimeFun?.();

  expect(callDestroyLifetimeFun).toHaveBeenCalledTimes(1);
  expect(peer.removeEventListener).toHaveBeenCalled();
});

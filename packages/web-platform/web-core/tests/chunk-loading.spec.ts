// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, rstest, test } from '@rstest/core';
import { createChunkLoading } from '../ts/client/background/background-apis/createChunkLoading.js';
import type { BundleInitReturnObj, NativeTTObject } from '../ts/types/index.js';

const bundleSource = `
  module.exports = {
    lexicalConsole: console,
    workerConsole: globalThis.console,
  };
`;

function createTT(
  NativeModules: Record<string, unknown>,
  sharedConsole?: unknown,
): NativeTTObject {
  return {
    NativeModules,
    sharedConsole,
  } as unknown as NativeTTObject;
}

function loadSyncBundle(source: string): BundleInitReturnObj {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'XMLHttpRequest',
  );

  Object.defineProperty(globalThis, 'XMLHttpRequest', {
    configurable: true,
    value: class {
      responseText = source;
      status = 200;

      open() {}
      send() {}
    },
  });

  try {
    return createChunkLoading('/main.web.bundle', 'react').loadScript(
      'app-service.js',
    );
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'XMLHttpRequest', descriptor);
    } else {
      delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    }
  }
}

async function loadAsyncBundle(source: string): Promise<BundleInitReturnObj> {
  const fetch = globalThis.fetch;
  globalThis.fetch = rstest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve(source),
    } as Response)
  );

  try {
    return await new Promise((resolve, reject) => {
      createChunkLoading('/main.web.bundle', 'react').loadScriptAsync(
        'async-chunk.js',
        (message, bundle) => {
          if (message || !bundle) {
            reject(new Error(message ?? 'Bundle was not loaded'));
          } else {
            resolve(bundle);
          }
        },
      );
    });
  } finally {
    globalThis.fetch = fetch;
  }
}

type BundleExports = {
  lexicalConsole: unknown;
  workerConsole: unknown;
};

describe('createChunkLoading', () => {
  test('injects a view-scoped console without changing the Worker console', () => {
    const bundle = loadSyncBundle(bundleSource);
    const pageAConsole = { log: rstest.fn() };
    const pageBConsole = { log: rstest.fn() };
    const sharedConsole = { log: rstest.fn() };

    const pageAExports = bundle.init({
      tt: createTT({ LynxConsoleModule: pageAConsole }, sharedConsole),
    }) as BundleExports;
    const pageBExports = bundle.init({
      tt: createTT({ LynxConsoleModule: pageBConsole }, sharedConsole),
    }) as BundleExports;

    expect(pageAExports.lexicalConsole).toBe(pageAConsole);
    expect(pageBExports.lexicalConsole).toBe(pageBConsole);
    expect(pageAExports.workerConsole).toBe(globalThis.console);
    expect(pageBExports.workerConsole).toBe(globalThis.console);
  });

  test('falls back to the shared console and then the Worker console', () => {
    const bundle = loadSyncBundle(bundleSource);
    const sharedConsole = { log: rstest.fn() };

    const sharedConsoleExports = bundle.init({
      tt: createTT({}, sharedConsole),
    }) as BundleExports;
    const workerConsoleExports = bundle.init({
      tt: createTT({}),
    }) as BundleExports;

    expect(sharedConsoleExports.lexicalConsole).toBe(sharedConsole);
    expect(workerConsoleExports.lexicalConsole).toBe(globalThis.console);
  });

  test('injects the view-scoped console into asynchronously loaded chunks', async () => {
    const bundle = await loadAsyncBundle(bundleSource);
    const viewConsole = { log: rstest.fn() };

    const exports = bundle.init({
      tt: createTT({ LynxConsoleModule: viewConsole }),
    }) as BundleExports;

    expect(exports.lexicalConsole).toBe(viewConsole);
    expect(exports.workerConsole).toBe(globalThis.console);
  });
});

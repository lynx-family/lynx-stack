import '../../lazy/import.js';

// `rstest.resetModules()` must be a literal call so rstest's static transform
// can hoist it (module-mock APIs cannot be reached through an import alias).
import { describe, expect, rstest, test } from '@rstest/core';
import * as ReactExports from '../../lazy/react.js';
import * as ReactCompatExports from '../../lazy/compat.js';
import * as ReactLepusExports from '../../lazy/react-lepus.js';
import * as ReactInternalExports from '../../lazy/internal.js';
import * as ReactJSXRuntimeExports from '../../lazy/jsx-runtime.js';
import * as ReactJSXDevRuntimeExports from '../../lazy/jsx-dev-runtime.js';
import * as ReactLegacyReactRuntimeExports from '../../lazy/legacy-react-runtime.js';
import {
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  RUNTIME_BACKEND_SNAPSHOT,
  registerLazyRuntimeBackend,
  sRuntimeBackend,
  target,
} from '../../lazy/target.js';

function restoreDescriptor(target, symbol, descriptor) {
  if (descriptor) {
    Object.defineProperty(target, symbol, descriptor);
  } else {
    delete target[symbol];
  }
}

async function withRuntimeBackend(backend, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(target, sRuntimeBackend);
  if (backend === undefined) {
    delete target[sRuntimeBackend];
  } else {
    Object.defineProperty(target, sRuntimeBackend, {
      value: backend,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  try {
    return await callback();
  } finally {
    restoreDescriptor(target, sRuntimeBackend, descriptor);
  }
}

describe('Lazy Exports', () => {
  test('export APIs from "react"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react'),
    );

    expect(
      new Set(Object.keys(ReactExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('export APIs from "react/compat"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/compat'),
    );

    expect(
      new Set(Object.keys(ReactCompatExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('export APIs from "react/lepus"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/lepus'),
    );

    expect(
      new Set(Object.keys(ReactLepusExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('export APIs from "internal"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/internal'),
    );

    expect(
      new Set(Object.keys(ReactInternalExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('export APIs from "jsx-runtime"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/jsx-runtime'),
    );

    expect(
      new Set(Object.keys(ReactJSXRuntimeExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('export APIs from "jsx-dev-runtime"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/jsx-dev-runtime'),
    );

    expect(
      new Set(Object.keys(ReactJSXDevRuntimeExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('export APIs from "legacy-react-runtime"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/legacy-react-runtime'),
    );

    expect(
      new Set(Object.keys(ReactLegacyReactRuntimeExports)),
    ).toStrictEqual(
      new Set(Object.keys(realAPIs)),
    );
  });

  test('target background', async () => {
    rstest.resetModules();

    const lynx = {};
    rstest.stubGlobal('lynx', lynx);
    rstest.stubGlobal('__LEPUS__', false);

    const { target } = await import('../../lazy/target.js');
    expect(target).toBe(lynx);
  });

  test('target main-thread', async () => {
    rstest.resetModules();

    rstest.stubGlobal('__LEPUS__', true);

    const { target } = await import('../../lazy/target.js');
    expect(target).toBe(globalThis);
  });

  test('records the Snapshot backend for the standalone lazy import', () => {
    expect(target[sRuntimeBackend]).toBe(RUNTIME_BACKEND_SNAPSHOT);
  });

  test('records a lazy backend when no main template marker exists', async () => {
    await withRuntimeBackend(undefined, () => {
      registerLazyRuntimeBackend(RUNTIME_BACKEND_SNAPSHOT);

      expect(target[sRuntimeBackend]).toBe(RUNTIME_BACKEND_SNAPSHOT);
    });
  });

  test('allows matching lazy backend registration', () => {
    expect(() => registerLazyRuntimeBackend(RUNTIME_BACKEND_SNAPSHOT)).not.toThrow();
  });

  test('throws when a lazy bundle backend does not match the main template backend', () => {
    expect(() => registerLazyRuntimeBackend(RUNTIME_BACKEND_ELEMENT_TEMPLATE)).toThrow(
      'Snapshot and Element Template templates cannot share lazy bundles.',
    );
  });

  test('throws before ET lazy import initializes ET runtime under a Snapshot template', async () => {
    const originalUpdateCardData = lynxCoreInject.tt.updateCardData;

    await expect(import('../../lazy/element-template-import.js')).rejects.toThrow(
      'Snapshot and Element Template templates cannot share lazy bundles.',
    );
    expect(lynxCoreInject.tt.updateCardData).toBe(originalUpdateCardData);
  });

  test('throws when an ET runtime marker imports the Snapshot standalone lazy entry', async () => {
    await withRuntimeBackend(undefined, async () => {
      rstest.resetModules();

      await import('../../src/element-template/runtime-backend-marker.ts');
      expect(target[sRuntimeBackend]).toBe(RUNTIME_BACKEND_ELEMENT_TEMPLATE);

      await expect(import('../../lazy/import.js')).rejects.toThrow(
        'Snapshot and Element Template templates cannot share lazy bundles.',
      );
    });
  });
});

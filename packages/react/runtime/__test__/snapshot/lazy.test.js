import '../../lazy/import.js';

import { describe, expect, test, vi } from 'vitest';
import * as ReactExports from '../../lazy/react.js';
import * as ReactCompatExports from '../../lazy/compat.js';
import * as ReactLepusExports from '../../lazy/react-lepus.js';
import * as ReactInternalExports from '../../lazy/internal.js';
import * as ReactJSXRuntimeExports from '../../lazy/jsx-runtime.js';
import * as ReactJSXDevRuntimeExports from '../../lazy/jsx-dev-runtime.js';
import * as ReactLegacyReactRuntimeExports from '../../lazy/legacy-react-runtime.js';
import { mainThreadObjectDefinition } from '../../src/mainThreadObjectDefinition.js';
import {
  RUNTIME_BACKEND_ELEMENT_TEMPLATE,
  RUNTIME_BACKEND_SNAPSHOT,
  registerLazyRuntimeBackend,
  sExportsReact,
  sExportsReactCompat,
  sExportsReactInternal,
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
  test('exports an opaque MainThreadObject build marker', () => {
    expect(mainThreadObjectDefinition).toEqual({});
    expect(Object.isFrozen(mainThreadObjectDefinition)).toBe(true);
  });

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

  test('forwards MainThreadObject lazy exports to a compatible runtime', () => {
    const definition = {
      type: '@test/lazy-compatible',
      create: value => ({ value }),
    };

    const reactType = ReactExports.defineMainThreadObjectType(definition);
    const compatType = ReactCompatExports.defineMainThreadObjectType(definition);
    expect(reactType).toMatchObject({ type: definition.type });
    expect(reactType).not.toHaveProperty('create');
    expect(reactType.isHandle).toBeTypeOf('function');
    expect(reactType.getInitialPayload).toBeTypeOf('function');
    expect(compatType).toMatchObject({ type: definition.type });
    expect(compatType).not.toHaveProperty('create');
    expect(compatType.isHandle).toBeTypeOf('function');
    expect(compatType.getInitialPayload).toBeTypeOf('function');
    expect(() => ReactExports.useMainThreadObject(reactType, 1)).toThrow();
    expect(() => ReactCompatExports.useMainThreadObject(compatType, 1)).toThrow();

    expect(ReactInternalExports.captureMainThreadObject({})).toBeUndefined();
    expect(() => ReactInternalExports.registerMainThreadObjectDefinition(definition)).not.toThrow();
  });

  test('does not require MainThreadObject registration during module evaluation', () => {
    const originalJS = globalThis.__JS__;
    const originalLepus = globalThis.__LEPUS__;
    const originalMainThread = globalThis.__MAIN_THREAD__;
    const originalBackground = globalThis.__BACKGROUND__;
    const originalWorkletImpl = globalThis.lynxWorkletImpl;
    const registerMainThreadObjectType = vi.fn();
    const create = value => ({ value });

    globalThis.__JS__ = false;
    globalThis.__LEPUS__ = true;
    globalThis.__MAIN_THREAD__ = true;
    globalThis.__BACKGROUND__ = false;
    globalThis.lynxWorkletImpl = {
      _refImpl: {
        registerMainThreadObjectType,
      },
    };

    try {
      ReactExports.defineMainThreadObjectType({
        type: '@test/lazy-module-evaluation',
        create,
      });

      expect(registerMainThreadObjectType).not.toHaveBeenCalled();
    } finally {
      globalThis.__JS__ = originalJS;
      globalThis.__LEPUS__ = originalLepus;
      globalThis.__MAIN_THREAD__ = originalMainThread;
      globalThis.__BACKGROUND__ = originalBackground;
      globalThis.lynxWorkletImpl = originalWorkletImpl;
    }
  });

  test('diagnoses MainThreadObject lazy bundle/runtime mismatches', async () => {
    const reactDescriptor = Object.getOwnPropertyDescriptor(target, sExportsReact);
    const compatDescriptor = Object.getOwnPropertyDescriptor(target, sExportsReactCompat);
    const internalDescriptor = Object.getOwnPropertyDescriptor(target, sExportsReactInternal);
    Object.defineProperty(target, sExportsReact, {
      ...reactDescriptor,
      value: {
        ...target[sExportsReact],
        defineMainThreadObjectType: undefined,
        useMainThreadObject: undefined,
      },
    });
    Object.defineProperty(target, sExportsReactInternal, {
      ...internalDescriptor,
      value: {
        ...target[sExportsReactInternal],
        captureMainThreadObject: undefined,
        registerMainThreadObjectDefinition: undefined,
      },
    });
    Object.defineProperty(target, sExportsReactCompat, {
      ...compatDescriptor,
      value: {
        ...target[sExportsReactCompat],
        defineMainThreadObjectType: undefined,
        useMainThreadObject: undefined,
      },
    });

    try {
      vi.resetModules();
      const incompatibleReact = await import('../../lazy/react.js?missing-main-thread-object');
      const incompatibleCompat = await import('../../lazy/compat.js?missing-main-thread-object');
      const incompatibleInternal = await import('../../lazy/internal.js?missing-main-thread-object');

      expect(() => incompatibleReact.defineMainThreadObjectType({})).toThrow(
        'This lazy bundle requires ReactLynx runtime export defineMainThreadObjectType for MainThreadObject.',
      );
      expect(() => incompatibleReact.useMainThreadObject({}, 1)).toThrow(
        'This lazy bundle requires ReactLynx runtime export useMainThreadObject for MainThreadObject.',
      );
      expect(() => incompatibleCompat.defineMainThreadObjectType({})).toThrow(
        'This lazy bundle requires ReactLynx runtime export defineMainThreadObjectType for MainThreadObject.',
      );
      expect(() => incompatibleCompat.useMainThreadObject({}, 1)).toThrow(
        'This lazy bundle requires ReactLynx runtime export useMainThreadObject for MainThreadObject.',
      );
      expect(() => incompatibleInternal.captureMainThreadObject({}, {})).toThrow(
        'This lazy bundle uses MainThreadObject capture support that is unavailable in the main ReactLynx runtime.',
      );
      expect(() => incompatibleInternal.registerMainThreadObjectDefinition({})).toThrow(
        'This lazy bundle uses MainThreadObject static registration that is unavailable in the main ReactLynx runtime.',
      );
    } finally {
      restoreDescriptor(target, sExportsReact, reactDescriptor);
      restoreDescriptor(target, sExportsReactCompat, compatDescriptor);
      restoreDescriptor(target, sExportsReactInternal, internalDescriptor);
    }
  });

  test('target background', async () => {
    vi.resetModules();

    const lynx = {};
    vi.stubGlobal('lynx', lynx);
    vi.stubGlobal('__LEPUS__', false);

    const { target } = await import('../../lazy/target.js');
    expect(target).toBe(lynx);
  });

  test('target main-thread', async () => {
    vi.resetModules();

    vi.stubGlobal('__LEPUS__', true);

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
      vi.resetModules();

      await import('../../src/element-template/runtime-backend-marker.ts');
      expect(target[sRuntimeBackend]).toBe(RUNTIME_BACKEND_ELEMENT_TEMPLATE);

      await expect(import('../../lazy/import.js')).rejects.toThrow(
        'Snapshot and Element Template templates cannot share lazy bundles.',
      );
    });
  });
});

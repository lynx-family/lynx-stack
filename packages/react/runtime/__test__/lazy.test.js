import '../lazy/import.js';

import { describe, expect, test, vi } from 'vitest';
import * as ReactExports from '../lazy/react.js';
import * as ReactCompatExports from '../lazy/compat.js';
import * as ReactLepusExports from '../lazy/react-lepus.js';
import * as ReactInternalExports from '../lazy/internal.js';
import * as ReactRuntimeComponentsExports from '../lazy/runtime-components.js';
import * as ReactJSXRuntimeExports from '../lazy/jsx-runtime.js';
import * as ReactJSXDevRuntimeExports from '../lazy/jsx-dev-runtime.js';
import * as ReactLegacyReactRuntimeExports from '../lazy/legacy-react-runtime.js';

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

  test('export APIs from "runtime-components"', async () => {
    const realAPIs = Object.assign(
      {},
      await import('@lynx-js/react/runtime-components'),
    );

    expect(
      new Set(Object.keys(ReactRuntimeComponentsExports)),
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
    vi.resetModules();

    const lynx = {};
    vi.stubGlobal('lynx', lynx);
    vi.stubGlobal('__LEPUS__', false);

    const { target } = await import('../lazy/target.js');
    expect(target).toBe(lynx);
  });

  test('target main-thread', async () => {
    vi.resetModules();

    vi.stubGlobal('__LEPUS__', true);

    const { target } = await import('../lazy/target.js');
    expect(target).toBe(globalThis);
  });
});

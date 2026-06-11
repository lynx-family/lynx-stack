import type { ComponentType } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ElementTemplateRuntime, * as ElementTemplateRoot from '@lynx-js/react/element-template';
import { Suspense, lazy } from '@lynx-js/react/element-template';
import * as ElementTemplateInternal from '@lynx-js/react/element-template/internal';
import { loadLazyBundle } from '@lynx-js/react/element-template/internal';

import { ElementTemplateEnvManager } from '../test-utils/debug/envManager.js';

interface LazyExports {
  default: ComponentType<Record<string, never>>;
  data?: string;
}

interface QueryComponentResult {
  code: number;
  detail: {
    schema: string;
    errMsg?: string;
  };
}

type QueryComponentCallback = (result: QueryComponentResult) => void;

type DynamicImport = <T>(
  url: string,
  options?: { with?: { type?: 'component' | 'tsx' | 'jsx' } },
) => Promise<T>;

type ElementTemplateInternalWithDynamicImport = typeof ElementTemplateInternal & {
  __dynamicImport?: DynamicImport;
  loadDynamicJS?: <T>(url: string) => Promise<T>;
};

type LynxWithDynamicImportMocks = typeof lynx & {
  QueryComponent?: (source: string, callback: QueryComponentCallback) => void;
  requireModuleAsync?: <T>(
    source: string,
    callback: (error: Error | null, data?: T) => void,
  ) => void;
};

type DynamicExportsGetter = (schema: string) => LazyExports | undefined;

const envManager = new ElementTemplateEnvManager();
const TestComponent = (() => null) as ComponentType<Record<string, never>>;
const internalWithDynamicImport = ElementTemplateInternal as ElementTemplateInternalWithDynamicImport;
const sExportsReact = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react)');
const sExportsReactCompat = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/compat)');
const sExportsReactLepus = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/lepus)');
const sExportsReactInternal = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/internal)');
const sExportsJSXRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-runtime)');
const sExportsJSXDevRuntime = Symbol.for('__REACT_LYNX_EXPORTS__(@lynx-js/react/jsx-dev-runtime)');
const sExportsLegacyReactRuntime = Symbol.for(
  '__REACT_LYNX_EXPORTS__(@lynx-js/react/legacy-react-runtime)',
);
const sRuntimeBackend = Symbol.for('__REACT_LYNX_RUNTIME_BACKEND__');
const lazyTargetSymbols = [
  sRuntimeBackend,
  sExportsReact,
  sExportsReactCompat,
  sExportsReactLepus,
  sExportsReactInternal,
  sExportsJSXRuntime,
  sExportsJSXDevRuntime,
  sExportsLegacyReactRuntime,
];

function makeExports(data: string): LazyExports {
  return {
    default: TestComponent,
    data,
  };
}

function restoreProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value === undefined) {
    delete target[key];
    return;
  }

  target[key] = value;
}

function captureLazyTargetDescriptors(): Map<symbol, PropertyDescriptor | undefined> {
  const target = lynx as typeof lynx & Record<symbol, unknown>;
  return new Map(
    lazyTargetSymbols.map(symbol => [
      symbol,
      Object.getOwnPropertyDescriptor(target, symbol),
    ]),
  );
}

function restoreLazyTargetDescriptors(
  descriptors: Map<symbol, PropertyDescriptor | undefined>,
): void {
  const target = lynx as typeof lynx & Record<symbol, unknown>;
  for (const symbol of lazyTargetSymbols) {
    const descriptor = descriptors.get(symbol);
    if (descriptor) {
      Object.defineProperty(target, symbol, descriptor);
    } else {
      delete target[symbol];
    }
  }
}

function clearLazyTargetSymbols(): void {
  const target = lynx as typeof lynx & Record<symbol, unknown>;
  for (const symbol of lazyTargetSymbols) {
    delete target[symbol];
  }
}

describe('element-template Suspense and lazy imports', () => {
  let originalQueryComponent: LynxWithDynamicImportMocks['QueryComponent'];
  let originalRequireModuleAsync: LynxWithDynamicImportMocks['requireModuleAsync'];
  let originalGetDynamicComponentExports: DynamicExportsGetter | undefined;
  let originalLazyTargetDescriptors: Map<symbol, PropertyDescriptor | undefined>;

  beforeEach(() => {
    vi.clearAllMocks();
    envManager.resetEnv('background');

    originalQueryComponent = (lynx as LynxWithDynamicImportMocks).QueryComponent;
    originalRequireModuleAsync = (lynx as LynxWithDynamicImportMocks).requireModuleAsync;
    originalGetDynamicComponentExports = (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports;
    originalLazyTargetDescriptors = captureLazyTargetDescriptors();
  });

  afterEach(() => {
    restoreProperty(lynx as LynxWithDynamicImportMocks, 'QueryComponent', originalQueryComponent);
    restoreProperty(
      lynx as LynxWithDynamicImportMocks,
      'requireModuleAsync',
      originalRequireModuleAsync,
    );
    restoreProperty(
      lynxCoreInject.tt as typeof lynxCoreInject.tt & {
        getDynamicComponentExports?: DynamicExportsGetter;
      },
      'getDynamicComponentExports',
      originalGetDynamicComponentExports,
    );
    restoreLazyTargetDescriptors(originalLazyTargetDescriptors);
    envManager.resetEnv('background');
  });

  it('exposes Suspense and lazy from the ET root entry', () => {
    expect(Suspense).toEqual(expect.any(Function));
    expect(lazy).toEqual(expect.any(Function));
    expect(ElementTemplateRuntime.Suspense).toBe(Suspense);
    expect(ElementTemplateRuntime.lazy).toBe(lazy);
  });

  it('exposes shared loadLazyBundle without enabling component-is', () => {
    expect(loadLazyBundle).toEqual(expect.any(Function));
    expect(ElementTemplateInternal.loadLazyBundle).toBe(loadLazyBundle);
    expect('__ComponentIsPolyfill' in ElementTemplateInternal).toBe(false);
  });

  it('exposes dynamic import helpers without enabling Snapshot-only internals', () => {
    expect(internalWithDynamicImport.__dynamicImport).toEqual(expect.any(Function));
    expect(internalWithDynamicImport.loadDynamicJS).toEqual(expect.any(Function));
    expect('__ComponentIsPolyfill' in ElementTemplateInternal).toBe(false);
    expect('__DynamicPartSlot' in ElementTemplateInternal).toBe(false);
    expect('snapshotCreatorMap' in ElementTemplateInternal).toBe(false);
  });

  it('routes ET component dynamic imports through loadLazyBundle', async () => {
    const QueryComponent = vi.fn((source: string, callback: QueryComponentCallback) => {
      callback({ code: 0, detail: { schema: source } });
    });
    const getDynamicComponentExports = vi.fn((schema: string) => makeExports(schema));
    (lynx as LynxWithDynamicImportMocks).QueryComponent = QueryComponent;
    (lynxCoreInject.tt as typeof lynxCoreInject.tt & {
      getDynamicComponentExports?: DynamicExportsGetter;
    }).getDynamicComponentExports = getDynamicComponentExports;

    const promise = internalWithDynamicImport.__dynamicImport!<LazyExports>(
      'entry-component',
      { with: { type: 'component' } },
    );

    expect(QueryComponent).toHaveBeenCalledWith('entry-component', expect.any(Function));
    expect(getDynamicComponentExports).toHaveBeenCalledWith('entry-component');
    await expect(promise).resolves.toMatchObject({ data: 'entry-component' });
  });

  it('routes ET plain dynamic imports through lynx.requireModuleAsync', async () => {
    const requireModuleAsync = vi.fn((
      source: string,
      callback: (error: Error | null, data?: { data: string }) => void,
    ) => {
      callback(null, { data: source });
    });
    (lynx as LynxWithDynamicImportMocks).requireModuleAsync = requireModuleAsync;

    await expect(
      internalWithDynamicImport.__dynamicImport!<{ data: string }>('entry-plain'),
    ).resolves.toEqual({ data: 'entry-plain' });
    expect(requireModuleAsync).toHaveBeenCalledWith('entry-plain', expect.any(Function));
  });

  it('populates standalone lazy target symbols with ET root/internal and lazy ABI exports', async () => {
    clearLazyTargetSymbols();
    vi.resetModules();

    await import('../../../lazy/element-template-import.js');
    const [
      elementTemplateRoot,
      reactCompat,
      elementTemplateInternal,
      jsxRuntime,
      jsxDevRuntime,
      legacyReactRuntime,
      lazyCompat,
      lazyLegacyReactRuntime,
    ] = await Promise.all([
      import('@lynx-js/react/element-template'),
      import('@lynx-js/react/compat'),
      import('@lynx-js/react/element-template/internal'),
      import('@lynx-js/react/jsx-runtime'),
      import('@lynx-js/react/jsx-dev-runtime'),
      import('@lynx-js/react/legacy-react-runtime'),
      import('../../../lazy/compat.js'),
      import('../../../lazy/legacy-react-runtime.js'),
    ]);

    const target = lynx as typeof lynx & Record<symbol, unknown>;
    expect(target[sRuntimeBackend]).toBe('Element Template');
    expect(target[sExportsReact]).toBe(elementTemplateRoot);
    expect(target[sExportsReactCompat]).toBe(reactCompat);
    expect(target[sExportsReactLepus]).toBe(elementTemplateRoot);
    expect(target[sExportsReactInternal]).toBe(elementTemplateInternal);
    expect(target[sExportsJSXRuntime]).toBe(jsxRuntime);
    expect(target[sExportsJSXDevRuntime]).toBe(jsxDevRuntime);
    expect(target[sExportsLegacyReactRuntime]).toBe(legacyReactRuntime);
    expect(lazyCompat.default).toBe(reactCompat.default);
    expect(lazyCompat.startTransition).toBe(reactCompat.startTransition);
    expect(lazyLegacyReactRuntime.default).toBe(legacyReactRuntime.default);
    expect(lazyLegacyReactRuntime.Component).toBe(legacyReactRuntime.Component);
  });
});

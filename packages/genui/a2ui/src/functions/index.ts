// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  Catalog as A2UICoreCatalog,
  MessageProcessor as A2UICoreMessageProcessor,
  isSignal,
} from '@a2ui/web_core/v0_9';
import type { DataContext, FunctionImplementation } from '@a2ui/web_core/v0_9';
import { BASIC_FUNCTIONS } from '@a2ui/web_core/v0_9/basic_catalog';

import { defineFunction } from '../catalog/defineCatalog.js';
import type {
  CatalogFunctionDefinition,
  CatalogFunctionEntry,
  FunctionManifest,
} from '../catalog/defineCatalog.js';
import { functionRegistry } from '../store/FunctionRegistry.js';
import type {
  FunctionCallContext,
  FunctionImpl,
} from '../store/FunctionRegistry.js';

const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

function createUpstreamContext(
  context: FunctionCallContext | undefined,
): DataContext {
  return {
    resolveDynamicValue(value: unknown) {
      return context?.resolveDynamicValue(value);
    },
    resolveSignal(value: unknown) {
      return context?.resolveSignal(value);
    },
    set(path: string, value: unknown) {
      context?.set(path, value);
    },
    path: context?.dataContextPath ?? '/',
  } as unknown as DataContext;
}

/**
 * Adapt an upstream `FunctionImplementation` (zod-typed args, returns a
 * raw value OR a Preact Signal, takes a `DataContext`) into the simpler
 * `(args) => unknown` shape the renderer's `executeFunctionCall` expects.
 */
function adaptUpstreamImpl(impl: FunctionImplementation): FunctionImpl {
  return (args, context) => {
    const safeArgs = impl.schema.parse(args) as Record<string, unknown>;
    const result: unknown = impl.execute(
      safeArgs,
      createUpstreamContext(context),
    );
    if (isSignal(result)) return result.value as unknown;
    return result;
  };
}

const adaptedBasicFunctionImpls: readonly {
  name: string;
  impl: FunctionImpl;
}[] = BASIC_FUNCTIONS.map(fn => ({
  name: fn.name,
  impl: adaptUpstreamImpl(fn),
}));

function createBasicFunctionManifests(): Map<string, FunctionManifest> {
  const upstreamCatalog = new A2UICoreCatalog(
    BASIC_CATALOG_ID,
    [],
    BASIC_FUNCTIONS,
  );
  const processor = new A2UICoreMessageProcessor([upstreamCatalog]);
  const inlineCatalog = processor.getClientCapabilities({
    includeInlineCatalogs: true,
  })['v0.9'].inlineCatalogs?.[0];
  const definitions = inlineCatalog?.functions ?? [];
  return new Map(definitions.map(definition => {
    const typedDefinition = definition as CatalogFunctionDefinition;
    return [
      typedDefinition.name,
      { [typedDefinition.name]: typedDefinition },
    ];
  }));
}

const basicFunctionManifests = createBasicFunctionManifests();

/**
 * The A2UI 0.9 basic-catalog function implementations packaged as
 * `CatalogFunctionEntry`s, ready to spread into `<A2UI catalogs={[...]}>`.
 * The impls themselves come from `@a2ui/web_core` so we stay aligned with
 * the upstream spec for free.
 *
 * @example
 *   <A2UI catalogs={[Text, Button, ...basicFunctions]} ... />
 */
export const basicFunctions: readonly CatalogFunctionEntry[] =
  adaptedBasicFunctionImpls
    .map(({ name, impl }) => {
      Object.defineProperty(impl, 'name', { value: name });
      return defineFunction(impl, basicFunctionManifests.get(name));
    });

/**
 * Manual escape hatch for consumers who build their own renderer and don't
 * go through `defineCatalog`. Registers every adapted basic-catalog impl
 * into the shared `functionRegistry`. Calling more than once is harmless —
 * later registrations override earlier ones, which is the intended override
 * path.
 */
export function registerBasicFunctions(): void {
  for (const entry of adaptedBasicFunctionImpls) {
    const definition = basicFunctionManifests.get(entry.name)?.[entry.name];
    functionRegistry.register({
      ...entry,
      ...(definition ? { definition } : {}),
    });
  }
}

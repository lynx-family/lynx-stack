// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { isSignal } from '@a2ui/web_core/v0_9';
import type { DataContext, FunctionImplementation } from '@a2ui/web_core/v0_9';
import { BASIC_FUNCTIONS } from '@a2ui/web_core/v0_9/basic_catalog';

import { defineFunction } from '../catalog/defineCatalog.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';
import { functionRegistry } from '../store/FunctionRegistry.js';
import type { FunctionImpl } from '../store/FunctionRegistry.js';

/**
 * Adapt an upstream `FunctionImplementation` (zod-typed args, returns a
 * raw value OR a Preact Signal, takes a `DataContext`) into the simpler
 * `(args) => unknown` shape the renderer's `executeFunctionCall` expects.
 *
 * For the validators + logic functions consumed by `useChecks`, the upstream
 * impl ignores its `context` argument, so passing `undefined as any` is
 * safe. The formatters/openUrl that do read `context` (e.g. `formatString`'s
 * `${path}` interpolation) are registered + announced to the agent here so
 * the handshake is complete, but they won't be reached at runtime until
 * action-side and dynamic-property `FunctionCall` evaluation land in a
 * follow-up PR — at which point a real `DataContext` will be plumbed.
 */
function adaptUpstreamImpl(impl: FunctionImplementation): FunctionImpl {
  return (args) => {
    const result: unknown = impl.execute(
      args,
      undefined as unknown as DataContext,
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

/**
 * The A2UI 0.9 basic-catalog function implementations packaged as
 * `CatalogFunctionEntry`s, ready to spread into `<A2UI catalogs={[...]}>`.
 * The impls themselves come from `@a2ui/web_core` so we stay aligned with
 * the upstream spec for free — `defineCatalog` only adds the
 * `functionRegistry` wiring and handshake serialization on top.
 *
 * @example
 *   <A2UI catalogs={[Text, Button, ...basicFunctions]} ... />
 */
export const basicFunctions: readonly CatalogFunctionEntry[] =
  adaptedBasicFunctionImpls
    .map(({ name, impl }) => {
      Object.defineProperty(impl, 'name', { value: name });
      return defineFunction(impl);
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
    functionRegistry.register(entry);
  }
}

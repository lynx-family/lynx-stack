// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { getValue, isSignal } from '@a2ui/web_core/v0_9';
import type { DataContext, FunctionImplementation } from '@a2ui/web_core/v0_9';
import { BASIC_FUNCTIONS } from '@a2ui/web_core/v0_9/basic_catalog';
import { zodToJsonSchema } from 'zod-to-json-schema';

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

const validationFunctions = new Set([
  'required',
  'regex',
  'length',
  'numeric',
  'email',
]);

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
    const value = isSignal(result) ? getValue(result) as unknown : result;
    return validationFunctions.has(impl.name)
      ? { valid: value === true }
      : value;
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
  return new Map(BASIC_FUNCTIONS.map(fn => {
    const parameters = (zodToJsonSchema as unknown as (
      schema: unknown,
      options: { $refStrategy: 'none' },
    ) => Record<string, unknown>)(fn.schema, { $refStrategy: 'none' });
    const definition: CatalogFunctionDefinition = {
      name: fn.name,
      parameters,
      returnType: validationFunctions.has(fn.name)
        ? 'validationResult'
        : fn.returnType,
      ...(fn.schema.description ? { description: fn.schema.description } : {}),
    };
    return [fn.name, { [fn.name]: definition }];
  }));
}

const basicFunctionManifests = createBasicFunctionManifests();

/**
 * The basic-catalog function implementations packaged as
 * `CatalogFunctionEntry`s, ready to spread into `<A2UI catalogs={[...]}>`.
 * The impls themselves come from `@a2ui/web_core` so we stay aligned with
 * the upstream function behavior. The adapter does not instantiate an upstream
 * protocol processor or accept its wire messages.
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

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ResponsePart } from '@a2ui/agent';
import { A2uiRequestProcessor, InMemoryCatalogProvider } from '@a2ui/agent';

import { BASIC_CATALOG } from '../a2ui/a2ui-catalog.js';
import type { A2UICatalog } from '../a2ui/a2ui-catalog.js';
import {
  expandA2UIMessage,
  validateA2UIOutput,
} from '../a2ui/a2ui-validator.js';
import type {
  ValidationOptions,
  ValidationResult,
} from '../a2ui/a2ui-validator.js';
import manifest from '../a2ui/catalog.json';

// Express derives positional signatures from schema order. Put the inherited
// layout weight after the component's own arguments (e.g. Text("Hello")).
function expressComponent(schema: { properties: Record<string, unknown> }) {
  const { '@checks': checks, weight, ...props } = schema.properties;
  return {
    ...schema,
    properties: { ...props, ...(weight ? { weight } : {}) },
    ...(checks
      ? { allOf: [{ $ref: 'common_types.json#/$defs/Checkable' }] }
      : {}),
  };
}

export function createExpressProcessor(catalog: A2UICatalog = BASIC_CATALOG) {
  const components = new Set(
    catalog.components.map(component => component.name),
  );
  const functions = new Set(catalog.functions?.map(fn => fn.name));
  const schema = {
    ...manifest,
    catalogId: catalog.id,
    components: Object.fromEntries(
      Object.entries(manifest.components)
        .filter(([name]) => components.has(name))
        .map(([name, component]) => [name, expressComponent(component)]),
    ),
    functions: Object.fromEntries(
      Object.entries(manifest.functions)
        .filter(([name]) => functions.has(name)),
    ),
  };
  return new A2uiRequestProcessor([new InMemoryCatalogProvider(schema).load()]);
}

// Lynx namespaces the protocol-owned component properties. Keep the SDK's
// objects intact because its streaming compiler retains component state.
function lynxComponent(component: Record<string, unknown>) {
  const props = { ...component };
  for (const key of ['checks', 'accessibility', 'metadata', 'catalogId']) {
    if (Object.hasOwn(props, key)) {
      props['@' + key] = props[key];
      delete props[key];
    }
  }
  return props;
}

export function expressMessages(parts: readonly ResponsePart[]): unknown[] {
  return parts.flatMap(part => part.type === 'a2ui' ? part.a2ui : []).map(
    message => {
      if ('createSurface' in message && message.createSurface.components) {
        const { createSurface } = message;
        return {
          ...message,
          createSurface: {
            ...createSurface,
            components: message.createSurface.components.map((
              component: Record<string, unknown>,
            ) => lynxComponent(component)),
          },
        };
      }
      if ('updateComponents' in message) {
        const { updateComponents } = message;
        return {
          ...message,
          updateComponents: {
            ...updateComponents,
            components: updateComponents.components.map((
              component: Record<string, unknown>,
            ) => lynxComponent(component)),
          },
        };
      }
      return message;
    },
  );
}

export function validateExpressOutput(
  source: string,
  catalog: A2UICatalog,
  processor = createExpressProcessor(catalog),
  options?: ValidationOptions,
): ValidationResult {
  try {
    const messages = expressMessages(processor.parseResponse(source));
    if (messages.length === 0) {
      throw new Error('Expected an A2UI Express <a2ui> block.');
    }
    const result = validateA2UIOutput(
      JSON.stringify(messages),
      catalog,
      options,
    );
    return {
      ...result,
      messages: result.messages.flatMap(message => expandA2UIMessage(message)),
    };
  } catch (error) {
    return {
      ok: false,
      messages: [],
      warnings: [],
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  A2UICatalog,
  A2UIComponentProp,
  A2UIComponentSpec,
} from './a2ui-catalog.js';
import type { A2UIMessage } from './a2ui-validator.js';
import { isLoadableImageSource } from './a2ui-validator.js';
import type { JevCandidate, JevComponent } from '../common/jev-tree.js';
import {
  JEV_STRUCTURAL_PROPS,
  describeJevComponents,
  isRecord,
} from '../common/jev-tree.js';
import { createJevValueSource, matches } from '../common/jev-values.js';
import type { JevValueBinding, JevValueChoice } from '../common/jev-values.js';

export {
  JEV_MAX_DEPTH,
  JEV_STRUCTURAL_PROPS,
  isRecord,
  jevChildIds,
} from '../common/jev-tree.js';
export type { JevCandidate, JevComponent } from '../common/jev-tree.js';

export interface JevContent {
  surface: Extract<A2UIMessage, { createSurface: unknown }>;
  data: Record<string, unknown>;
  components: JevComponent[];
}

/** Read a complete content snapshot, independently of its business domain. */
export function readJevContent(messages: A2UIMessage[]): JevContent {
  const surfaces = messages.filter(message => 'createSurface' in message);
  if (surfaces.length !== 1) {
    throw new Error(
      'Jev snapshot must return one complete surface.',
    );
  }
  const surface = surfaces[0]!;
  const surfaceId = surface.createSurface.surfaceId;
  let data: Record<string, unknown> = {};
  const components = new Map<string, JevComponent>();
  for (const message of messages) {
    if ('deleteSurface' in message) {
      throw new Error('Jev snapshot cannot delete its surface.');
    }
    if ('updateComponents' in message) {
      if (message.updateComponents.surfaceId !== surfaceId) {
        throw new Error('Jev snapshot must use one surface.');
      }
      for (const component of message.updateComponents.components) {
        components.set(component.id, component);
      }
    }
    if ('updateDataModel' in message) {
      const update = message.updateDataModel;
      if (
        update.surfaceId !== surfaceId || (update.path ?? '/') !== '/'
        || !isRecord(update.value)
      ) {
        throw new Error(
          'Jev snapshot must include the complete root data model.',
        );
      }
      data = update.value;
    }
  }
  return { surface, data, components: [...components.values()] };
}

export function describeJevTree(content: JevContent): JevCandidate[] {
  return describeJevComponents(content.components);
}

export type { JevValueChoice } from '../common/jev-values.js';

/** Resolved and authorized by the host, never inferred from prompts or conversation state. */
export interface HostedMcpAppResource {
  uri: string;
  title: string;
  url: string;
  webUrl?: string;
  mcpAppData: Record<string, unknown>;
}

export const JEV_MCP_APP_RESOURCE_PROPS = new Set([
  'url',
  'webUrl',
  'mcpAppData',
]);

function isMcpAppBundleURL(value: unknown): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function validHostedMcpApp(resource: HostedMcpAppResource): boolean {
  return isRecord(resource)
    && typeof resource.uri === 'string' && resource.uri.startsWith('ui://')
    && resource.uri.length > 'ui://'.length
    && typeof resource.title === 'string' && resource.title.trim().length > 0
    && isMcpAppBundleURL(resource.url)
    && (resource.webUrl === undefined || isMcpAppBundleURL(resource.webUrl))
    && isRecord(resource.mcpAppData)
    && typeof resource.mcpAppData.renderer === 'string'
    && resource.mcpAppData.renderer.trim().length > 0
    && isRecord(resource.mcpAppData.input);
}

export function jevShape(
  spec: A2UIComponentSpec,
): A2UIComponentSpec['containerShape'] {
  if (spec.containerShape) return spec.containerShape;
  const names = new Set(spec.props.map(prop => prop.name));
  if (names.has('children')) return 'children';
  if (names.has('child')) return 'child';
  if (names.has('tabs')) return 'tabs';
  if (names.has('trigger') && names.has('content')) return 'trigger-content';
  return 'none';
}

/** Finite values come from the request, Catalog enums, neutral defaults and state bindings. */
export function buildJevCandidates(
  catalog: A2UICatalog,
  requests: string[],
  data: Record<string, unknown>,
  isImageSourceAllowed?: (source: string) => boolean,
  hostedMcpApps: readonly HostedMcpAppResource[] = [],
) {
  const mcpAppSpec = catalog.components.find(spec => spec.name === 'McpApp');
  const mcpApps = hostedMcpApps.filter(resource =>
    validHostedMcpApp(resource)
    && mcpAppSpec?.props.filter(prop =>
      JEV_MCP_APP_RESOURCE_PROPS.has(prop.name)
    )
      .every(prop => {
        const value = resource[prop.name as 'url' | 'webUrl' | 'mcpAppData'];
        return value === undefined
          ? !prop.required
          : matches(value, prop.schema ?? { type: prop.type });
      })
  );
  const valueChoices = createJevValueSource(requests);
  const bindings: { path: string; value: unknown }[] = [];
  const walk = (value: unknown, path: string, depth: number) => {
    if (depth > 8 || bindings.length >= 128) return;
    if (path) bindings.push({ path, value });
    if (isRecord(value)) {
      for (const [key, item] of Object.entries(value)) {
        walk(
          item,
          `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`,
          depth + 1,
        );
      }
    }
  };
  walk(data, '', 0);
  const choices = (
    prop: A2UIComponentProp,
    component?: string,
  ): JevValueChoice[] => {
    // Resource properties are selected as an indivisible host-provided tuple.
    if (component === 'McpApp' && JEV_MCP_APP_RESOURCE_PROPS.has(prop.name)) {
      return [];
    }
    const imageSource = component === 'Image' && prop.name === 'url';
    const schema = prop.schema
      ?? { type: prop.type, ...(prop.enums ? { enum: prop.enums } : {}) };
    const encodedBindings: JevValueBinding[] = bindings.map(binding => ({
      value: { path: binding.path },
      resolved: binding.value,
      name: binding.path.split('/').at(-1)!,
      description: `Bind to ${binding.path} (${
        Array.isArray(binding.value) ? 'array' : typeof binding.value
      })`,
    }));
    return valueChoices({ name: prop.name, schema, required: prop.required }, {
      bindings: encodedBindings,
      // Empty initial input state is valid; empty generated display content is not.
      allowPlaceholder: !prop.required || (prop.name === 'value'
        && prop.schema?.oneOf?.some(branch => branch.properties?.path)
          === true),
      accept(value, resolved) {
        if (
          imageSource && (!isLoadableImageSource(resolved)
            || (isImageSourceAllowed && !isImageSourceAllowed(resolved)))
        ) return false;
        // Image bindings are supported even by string-only Catalogs.
        return matches(value, schema)
          || (imageSource && isRecord(value) && typeof value.path === 'string');
      },
    }).map(({ value, description, placeholder }) => ({
      value,
      description,
      ...(placeholder ? { placeholder } : {}),
    }));
  };
  const specs = catalog.components.filter(spec =>
    (spec.name !== 'McpApp' || mcpApps.length > 0)
    && spec.props.every(prop =>
      !prop.required || JEV_STRUCTURAL_PROPS.has(prop.name)
      || prop.name === 'action'
      || (spec.name === 'McpApp' && JEV_MCP_APP_RESOURCE_PROPS.has(prop.name))
      || choices(prop, spec.name).length > 0
    )
  );
  return { specs, choices, mcpApps };
}

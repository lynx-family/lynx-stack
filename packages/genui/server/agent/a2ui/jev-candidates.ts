// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  A2UICatalog,
  A2UIComponentProp,
  A2UIComponentSpec,
  JsonSchema,
} from './a2ui-catalog.js';
import type { A2UIMessage } from './a2ui-validator.js';
import { isLoadableImageSource } from './a2ui-validator.js';

export const JEV_MAX_DEPTH = 8;

export type JevComponent =
  & { id: string; component: string }
  & Record<string, unknown>;

export interface JevContent {
  surface: Extract<A2UIMessage, { createSurface: unknown }>;
  data: Record<string, unknown>;
  components: JevComponent[];
}

export interface JevCandidate {
  id: string;
  description: string;
  component: JevComponent;
  parent?: string;
  movable: boolean;
  acceptsChildren: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Preserve all A2UI child shapes, including compound and repeating components. */
export function jevChildIds(component: JevComponent): string[] {
  const refs: unknown[] = [
    component.child,
    component.trigger,
    component.content,
  ];
  if (Array.isArray(component.children)) {
    refs.push(...(component.children as unknown[]));
  }
  if (isRecord(component.children)) {
    refs.push(component.children.componentId);
    if (isRecord(component.children.template)) {
      refs.push(component.children.template.componentId);
    }
  }
  if (Array.isArray(component.tabs)) {
    for (const tab of component.tabs) if (isRecord(tab)) refs.push(tab.child);
  }
  return refs.filter((ref): ref is string => typeof ref === 'string');
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

/** Describe and validate a concrete component tree, including named and repeating slots. */
export function describeJevTree(content: JevContent): JevCandidate[] {
  if (content.components.length > 64) {
    throw new Error('Jev composition exceeds the 64-component limit.');
  }
  const byId = new Map(
    content.components.map(component => [component.id, component]),
  );
  const parents = new Map<string, string>();
  const templateScope = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: Set<string>, inTemplate: boolean) => {
    if (path.has(id)) throw new Error('Jev selected a cyclic layout.');
    if (path.size >= JEV_MAX_DEPTH) {
      throw new Error('Jev layout exceeds the depth limit.');
    }
    if (visited.has(id)) {
      throw new Error('Jev components must have exactly one parent.');
    }
    const component = byId.get(id);
    if (!component) throw new Error('Jev selected a missing child component.');
    visited.add(id);
    if (inTemplate) templateScope.add(id);
    const next = new Set(path).add(id);
    for (const child of jevChildIds(component)) {
      parents.set(child, id);
      visit(child, next, inTemplate || isRecord(component.children));
    }
  };
  visit('root', new Set(), false);
  if (visited.size !== content.components.length) {
    const unreachable = content.components.filter(component =>
      !visited.has(component.id)
    );
    throw new Error(
      `Jev composition contains unreachable components: ${
        unreachable.map(component => component.id).join(', ')
      }.`,
    );
  }
  return content.components.map(component => {
    const parent = parents.get(component.id);
    const parentComponent = parent === undefined ? undefined : byId.get(parent);
    // Only display copy is shared with Jev, never input values, bindings, or raw state.
    const copy = ['text', 'label', 'title', 'variant'].flatMap(key =>
      typeof component[key] === 'string'
        ? [`${key}: ${JSON.stringify(component[key])}`]
        : []
    ).join('; ').slice(0, 1000);
    return {
      id: component.id,
      component,
      description: `${component.component}${copy ? ` (${copy})` : ''}`,
      ...(parent === undefined ? {} : { parent }),
      movable: !templateScope.has(component.id)
        && Array.isArray(parentComponent?.children),
      acceptsChildren: !templateScope.has(component.id)
        && Array.isArray(component.children),
    };
  });
}

export interface JevValueChoice {
  value: unknown;
  description: string;
  /** A synthetic empty placeholder, not content supplied by the user or a Catalog enum. */
  placeholder?: boolean;
}

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

/** Match the Catalog schema without inventing values for open objects or functions. */
function matches(value: unknown, schema: JsonSchema): boolean {
  if ('const' in schema) return value === schema.const;
  if (Array.isArray(schema.enum)) return schema.enum.includes(value);
  if (schema.oneOf) return schema.oneOf.some(branch => matches(value, branch));
  if (schema.type === 'array') {
    return Array.isArray(value)
      && value.every(item => !schema.items || matches(item, schema.items));
  }
  if (schema.type === 'object' || schema.properties) {
    return isRecord(value)
      && (schema.required ?? []).every(key => Object.hasOwn(value, key))
      && Object.entries(value).every(([key, item]) => {
        const prop = schema.properties?.[key];
        return prop
          ? matches(item, prop)
          : schema.additionalProperties !== false;
      });
  }
  return schema.type === undefined || typeof value === schema.type;
}

function literals(schema: JsonSchema): unknown[] {
  if ('const' in schema) return [schema.const];
  if (Array.isArray(schema.enum)) return schema.enum;
  if (schema.oneOf) return schema.oneOf.flatMap(branch => literals(branch));
  if (schema.type === 'boolean') return [false, true];
  if (schema.type === 'number') return [0, 1, 16, 24, 48, 100, 200, 320];
  if (schema.type === 'string') return [''];
  if (schema.type === 'array') return [[]];
  if (schema.type === 'object' && (schema.required?.length ?? 0) === 0) {
    return [{}];
  }
  return [];
}

function isConstrainedValue(value: unknown, schema: JsonSchema): boolean {
  return ('const' in schema && value === schema.const)
    || (Array.isArray(schema.enum) && schema.enum.includes(value))
    || (schema.oneOf?.some(branch => isConstrainedValue(value, branch))
      ?? false);
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

export const JEV_CHILD_PROPS = new Set([
  'children',
  'child',
  'tabs',
  'trigger',
  'content',
]);

interface SuppliedValue {
  value: unknown;
  property?: string;
  rank: number;
  explicit: boolean;
}

/** Harvest complete content before bounded word fragments can consume its budget. */
function suppliedValues(requests: string[]): SuppliedValue[] {
  const values: SuppliedValue[] = [];
  const phrases: { text: string; rank: number }[] = [];
  const add = (value: unknown, rank: number, property?: string) => {
    if (values.length < 512 && JSON.stringify(value).length <= 4000) {
      values.push({
        value,
        rank,
        explicit: true,
        ...(property ? { property } : {}),
      });
    }
  };
  const collect = (
    value: unknown,
    rank: number,
    property?: string,
    depth = 0,
  ) => {
    if (depth > 8 || values.length >= 512) return;
    add(value, rank, property);
    if (Array.isArray(value)) {
      value.forEach(item => collect(item, rank, property, depth + 1));
    } else if (isRecord(value)) {
      Object.entries(value).forEach(([key, item]) =>
        collect(item, rank, key, depth + 1)
      );
    }
  };
  for (const [index, request] of [...requests].reverse().entries()) {
    const rank = index * 4;
    for (const match of request.matchAll(/https?:\/\/[^\s<>"`]+/g)) {
      add(match[0], rank + 1);
    }
    for (const match of request.matchAll(/```(?:json)?([\s\S]*?)```/g)) {
      try {
        collect(JSON.parse(match[1]!), rank);
      } catch { /* Ordinary prose. */ }
    }
    try {
      collect(JSON.parse(request), rank);
    } catch { /* Ordinary prose. */ }
    for (const match of request.matchAll(/["“]([^"”\n]+)["”]/g)) {
      add(match[1]!, rank + 1);
    }
    for (
      const text of request.split(/[\n.!?。！？:：,，;；]/).map(text =>
        text.trim()
      )
    ) {
      if (!text || phrases.length >= 256) continue;
      phrases.push({ text, rank: rank + 2 });
    }
    for (const match of request.matchAll(/-?\d+(?:\.\d+)?/g)) {
      const value = Number(match[0]);
      if (Number.isFinite(value)) add(value, rank + 2);
    }
  }
  const complete = phrases.filter(({ text }) => text.length <= 160)
    .map(({ text, rank }) => ({ value: text, rank, explicit: true }));
  const fragments: SuppliedValue[] = [];
  const seen = new Set(
    [...values, ...complete].map(item => JSON.stringify(item.value)),
  );
  const segmented = phrases.map(({ text, rank }) => ({
    text,
    rank,
    words: [
      ...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text),
    ]
      .filter(part => part.isWordLike),
  }));
  // Give every phrase a turn before moving to longer n-grams or isolated words.
  for (const length of [2, 3, 4, 5, 6, 1]) {
    for (const { text, rank, words } of segmented) {
      for (let start = 0; start + length <= words.length; start++) {
        const first = words[start]!;
        const last = words[start + length - 1]!;
        const value = text.slice(first.index, last.index + last.segment.length);
        const key = JSON.stringify(value);
        if (seen.has(key) || fragments.length >= 256) continue;
        seen.add(key);
        fragments.push({ value, rank: 100 + rank, explicit: false });
      }
    }
  }
  return [...values, ...complete, ...fragments];
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
  const values = suppliedValues(requests);
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
    const options: (JevValueChoice & { rank: number; explicit: boolean })[] =
      [];
    const add = (
      value: unknown,
      description: string,
      rank: number,
      explicit: boolean,
      resolved = value,
      placeholder = false,
    ) => {
      if (
        imageSource
        && (!isLoadableImageSource(resolved)
          || (isImageSourceAllowed && !isImageSourceAllowed(resolved)))
      ) return;
      // Image.url bindings are supported by the renderer even in string-only Catalogs.
      if (
        !matches(value, schema)
        && !(imageSource && isRecord(value) && typeof value.path === 'string')
      ) return;
      options.push({
        value,
        description,
        rank,
        explicit,
        ...(placeholder ? { placeholder } : {}),
      });
    };
    // Bindings expose only paths and types, never entered values to the decision model.
    for (const binding of bindings) {
      if (matches(binding.value, schema)) {
        add(
          { path: binding.path },
          `Bind to ${binding.path} (${
            Array.isArray(binding.value) ? 'array' : typeof binding.value
          })`,
          binding.path.split('/').at(-1)?.toLowerCase()
              === prop.name.toLowerCase()
            ? -1
            : 50,
          true,
          binding.value,
        );
      }
    }
    for (const { value, property, rank, explicit } of values) {
      // An unquoted enum value is an exact Catalog match, not a disposable fragment.
      const exact = isConstrainedValue(value, schema);
      const priority = !explicit && exact ? rank - 100 : rank;
      add(
        value,
        JSON.stringify(value),
        property?.toLowerCase() === prop.name.toLowerCase()
          ? priority - 0.5
          : priority,
        explicit || exact,
      );
    }
    for (const value of literals(schema)) {
      const placeholder = !isConstrainedValue(value, schema) && (value === ''
        || (Array.isArray(value) && value.length === 0)
        || (isRecord(value) && Object.keys(value).length === 0));
      add(
        value,
        `Catalog/default value: ${JSON.stringify(value)}`,
        200,
        !placeholder,
        value,
        placeholder,
      );
    }
    const seen = new Set<string>();
    const ranked = options.sort((a, b) => a.rank - b.rank).filter(option => {
      const key = JSON.stringify(option.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Normally 32 choices suffice. Grow only to preserve complete supplied values,
    // bindings and Catalog alternatives, with a small reserve for unquoted fragments.
    const explicit = ranked.filter(item => item.explicit);
    const derived = ranked.filter(item => !item.explicit && !item.placeholder);
    const limit = Math.min(96, Math.max(32, explicit.length + 8));
    const compact = explicit.slice(0, limit - Math.min(8, derived.length));
    compact.push(...derived.slice(0, limit - compact.length));
    compact.push(
      ...ranked.filter(item => item.placeholder).slice(
        0,
        limit - compact.length,
      ),
    );
    // An input's initial value may be empty; required display content cannot
    // be fulfilled by a synthesized empty string/array/object. Explicit empty
    // user values, bindings and enum/const choices remain available.
    const allowPlaceholder = !prop.required || (prop.name === 'value'
      && prop.schema?.oneOf?.some(branch => branch.properties?.path) === true);
    return compact.filter(choice => allowPlaceholder || !choice.placeholder)
      .sort((a, b) => a.rank - b.rank).map((
        { value, description, placeholder },
      ) => ({
        value,
        description,
        ...(placeholder ? { placeholder } : {}),
      }));
  };
  const specs = catalog.components.filter(spec =>
    (spec.name !== 'McpApp' || mcpApps.length > 0)
    && spec.props.every(prop =>
      !prop.required || JEV_CHILD_PROPS.has(prop.name) || prop.name === 'action'
      || (spec.name === 'McpApp' && JEV_MCP_APP_RESOURCE_PROPS.has(prop.name))
      || choices(prop, spec.name).length > 0
    )
  );
  return { specs, choices, mcpApps };
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { OpenUiPromptLibrary } from '@lynx-js/genui-openui/openui-prompt';

import { JEV_STRUCTURAL_PROPS, isRecord } from '../common/jev-tree.js';
import { createJevValueSource } from '../common/jev-values.js';
import type { JevRankedValueChoice, JsonSchema } from '../common/jev-values.js';

export interface OpenUIJevProp {
  name: string;
  required: boolean;
  schema: JsonSchema;
}

export interface OpenUIJevComponentSpec {
  name: string;
  summary: string;
  props: OpenUIJevProp[];
  shape: 'children' | 'buttons' | 'modal' | 'tabs' | 'none';
}

export type OpenUIJevValueChoice = JevRankedValueChoice;

export const isOpenUIJevMediaURL = (value: unknown) => {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

/** Read native component properties and slots from the active headless library. */
export function buildOpenUIJevCatalog(library: OpenUiPromptLibrary) {
  const schema = library.toJSONSchema();
  const normalize = (value: unknown): JsonSchema => {
    if (!isRecord(value)) return {};
    if (typeof value.$ref === 'string') {
      return normalize(schema.$defs?.[value.$ref.split('/').at(-1)!]);
    }
    return {
      ...value,
      ...(Array.isArray(value.anyOf)
        ? { oneOf: value.anyOf.map(item => normalize(item)) }
        : {}),
      ...(isRecord(value.properties)
        ? {
          properties: Object.fromEntries(
            Object.entries(value.properties).map((
              [key, prop],
            ) => [key, normalize(prop)]),
          ),
        }
        : {}),
      ...(value.items ? { items: normalize(value.items) } : {}),
    };
  };
  const specs: OpenUIJevComponentSpec[] = Object.keys(library.components).map(
    name => {
      const definition = schema.$defs?.[name];
      const props = Object.entries(definition?.properties ?? {}).map((
        [name, value],
      ) => ({
        name,
        required: definition?.required?.includes(name) ?? false,
        schema: normalize(value),
      }));
      const names = new Set(props.map(prop => prop.name));
      let shape: OpenUIJevComponentSpec['shape'] = 'none';
      if (names.has('children')) shape = 'children';
      else if (names.has('buttons')) shape = 'buttons';
      else if (names.has('tabs')) shape = 'tabs';
      else if (names.has('trigger') && names.has('content')) shape = 'modal';
      return {
        name,
        summary: definition?.description ?? name,
        props,
        shape,
      };
    },
  );
  const byName = new Map(specs.map(spec => [spec.name, spec]));
  return { schema, specs, byName };
}

/** Build finite choices without exposing entered state values to the evaluator. */
export function buildOpenUIJevCandidates(
  specs: OpenUIJevComponentSpec[],
  requests: string[],
  declarations: Record<string, unknown>,
) {
  const valueChoices = createJevValueSource(requests);
  const bindings = Object.entries(declarations).filter(([key]) =>
    /^\$[a-z_]\w*$/i.test(key)
  ).map(([key, value]) => ({
    value: { k: 'StateRef', n: key },
    resolved: value,
    name: key.slice(1),
    description: `Bind to ${key} (${
      Array.isArray(value) ? 'array' : typeof value
    })`,
  }));
  const byName = new Map(specs.map(spec => [spec.name, spec]));
  const choices = (
    prop: OpenUIJevProp,
    component: string,
  ): OpenUIJevValueChoice[] => {
    return valueChoices(prop, {
      bindings,
      accept(value, resolved) {
        if (
          prop.name === 'url'
          && ['Image', 'AudioPlayer', 'Video'].includes(component)
          && !isOpenUIJevMediaURL(resolved)
        ) return false;
        // OpenUI bindings must reference declared state, not A2UI paths.
        return !(isRecord(value) && typeof value.path === 'string');
      },
    });
  };
  const available = specs.filter(spec =>
    spec.props.every(prop =>
      !prop.required || JEV_STRUCTURAL_PROPS.has(prop.name)
      || choices(prop, spec.name).length > 0
    )
  )
    .filter(spec =>
      spec.shape !== 'modal'
      || byName.has('Button')
        && choices({
            name: 'label',
            required: true,
            schema: { type: 'string' },
          }, 'Button').length > 0
    )
    .filter(spec =>
      spec.shape !== 'tabs'
      || choices(
          { name: 'title', required: true, schema: { type: 'string' } },
          'Tabs',
        ).length > 0
    );
  return { choices, available };
}

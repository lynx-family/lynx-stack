// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG_EXAMPLES } from './a2ui-examples';
import type { A2UIExample } from './a2ui-examples';
import generatedCatalog from './catalog.json';

export interface A2UIComponentProp {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  enums?: readonly string[];
  schema?: JsonSchema;
}

export interface A2UIComponentSpec {
  name: string;
  summary: string;
  props: A2UIComponentProp[];
  requiresAction?: boolean;
  containerShape?: 'children' | 'child' | 'tabs' | 'trigger-content' | 'none';
}

export interface A2UICatalog {
  id: string;
  label: string;
  version?: string;
  components: A2UIComponentSpec[];
  extraRules?: string[];
  examples?: A2UIExample[];
  functions?: A2UIFunctionSpec[];
}

export interface A2UIFunctionSpec {
  description?: string;
  name: string;
  parameters: JsonSchema;
  returnType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'any'
    | 'void';
}

export const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

export interface JsonSchema {
  const?: unknown;
  type?: string;
  enum?: unknown;
  oneOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  additionalProperties?: unknown;
  unevaluatedProperties?: unknown;
}

interface CatalogManifest extends Record<string, JsonSchema> {}

const COMPONENT_SUMMARIES: Record<string, string> = {
  Button:
    'Clickable button. MUST always include an action. Has no "label" prop; use a child Text component for the visible label.',
  Card:
    'Card container with exactly one child. Wrap multiple elements in a Column/Row/List first.',
  CheckBox: 'Boolean checkbox with a label and optional validation checks.',
  ChoicePicker:
    'Single- or multi-select choice picker with checkbox and chip display styles.',
  Column:
    'Vertical layout container. Preferred for ordinary non-scrollable repeated content using template children.',
  DateTimeInput:
    'Date and/or time input with a calendar panel. Without outputFormat, date-enabled inputs write YYYY-MM-DD.',
  Divider: 'Horizontal or vertical separator line.',
  Icon: 'Display an icon by name.',
  Image: 'Display an image by URL.',
  LineChart: 'Display one or more numeric line series over shared labels.',
  List:
    'Scrollable repeating layout container. Use when repeated content needs scrolling; otherwise prefer Column or Row template children.',
  Loading: 'Animated progress indicator for pending content.',
  Modal:
    'Modal dialog with a trigger component and a content component. The trigger opens the modal locally when tapped.',
  PieChart: 'Display numeric slices as a pie or donut chart.',
  RadioGroup: 'Single-choice selector for a list of string options.',
  Row:
    'Horizontal layout container. Preferred for ordinary non-scrollable repeated content using template children.',
  Slider: 'Numeric slider with an optional label and validation checks.',
  Tabs: 'Tabbed container; each tab references a child component id.',
  Text:
    'Display styled text. Supports literal text, data bindings, and function calls.',
  TextField: 'Single-line or multi-line text input.',
};

const CONTAINER_SHAPES: Partial<
  Record<string, A2UIComponentSpec['containerShape']>
> = {
  Button: 'child',
  Card: 'child',
  Column: 'children',
  List: 'children',
  Modal: 'trigger-content',
  Row: 'children',
  Tabs: 'tabs',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function inferType(schema: JsonSchema | undefined): string {
  if (!schema) return 'unknown';

  if (schema.oneOf && schema.oneOf.length > 0) {
    return schema.oneOf.map((item) => inferType(item)).join(' | ');
  }

  if (schema.type === 'array') {
    return `${inferType(schema.items)}[]`;
  }

  if (schema.type === 'object') {
    const properties = schema.properties ?? {};
    const keys = Object.keys(properties);
    if (keys.length === 0) return 'object';
    const required = new Set(schema.required ?? []);
    const fields = keys.map((key) => {
      const optional = required.has(key) ? '' : '?';
      return `${key}${optional}: ${inferType(properties[key])}`;
    });
    return `{ ${fields.join('; ')} }`;
  }

  if (schema.type === 'string') {
    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum
        .filter((item): item is string => typeof item === 'string')
        .map((item) => `"${item}"`)
        .join(' | ');
    }
    return 'string';
  }

  if (schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  return schema.type ?? 'unknown';
}

function inferEnums(schema: JsonSchema | undefined): string[] | undefined {
  if (!schema) return undefined;
  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter((item): item is string =>
      typeof item === 'string'
    );
    return values.length > 0 ? values : undefined;
  }
  if (!schema.oneOf) return undefined;
  const nested = schema.oneOf.flatMap((item) => inferEnums(item) ?? []);
  return nested.length > 0 ? [...new Set(nested)] : undefined;
}

function componentFromManifest(
  manifest: CatalogManifest,
): A2UIComponentSpec | null {
  const [name, schema] = Object.entries(manifest)[0] ?? [];
  if (!name || !schema) return null;

  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = new Set(schema.required ?? []);
  const props = Object.entries(properties).map(([propName, propSchema]) => {
    const enums = inferEnums(propSchema);
    return {
      name: propName,
      type: inferType(propSchema),
      description: propSchema.description ?? '',
      required: required.has(propName),
      schema: propSchema,
      ...(enums ? { enums } : {}),
    };
  });

  return {
    name,
    summary: COMPONENT_SUMMARIES[name] ?? `${name} component.`,
    props,
    ...(name === 'Button' ? { requiresAction: true } : {}),
    ...(CONTAINER_SHAPES[name]
      ? { containerShape: CONTAINER_SHAPES[name] }
      : {}),
  };
}

function functionsFromGeneratedCatalog(catalog: unknown): A2UIFunctionSpec[] {
  if (!isRecord(catalog)) {
    return [];
  }
  const { functions } = catalog as { functions?: unknown };
  if (Array.isArray(functions)) {
    return functions.filter(
      (fn): fn is A2UIFunctionSpec => {
        if (!isRecord(fn)) {
          return false;
        }
        const candidate = fn as {
          name?: unknown;
          parameters?: unknown;
          returnType?: unknown;
        };
        return typeof candidate.name === 'string'
          && isRecord(candidate.parameters)
          && isFunctionReturnType(candidate.returnType);
      },
    );
  }
  if (!isRecord(functions)) {
    return [];
  }
  return Object.entries(functions)
    .map(([name, schema]) => functionSpecFromSchema(name, schema))
    .filter((fn): fn is A2UIFunctionSpec => fn !== null);
}

function functionSpecFromSchema(
  name: string,
  schema: unknown,
): A2UIFunctionSpec | null {
  if (!isRecord(schema)) {
    return null;
  }
  const schemaRecord = schema as {
    description?: unknown;
    properties?: unknown;
  };
  if (!isRecord(schemaRecord.properties)) {
    return null;
  }
  const properties = schemaRecord.properties as {
    args?: unknown;
    returnType?: unknown;
  };
  const args = properties.args;
  const returnType = properties.returnType;
  if (!isRecord(args) || !isRecord(returnType)) {
    return null;
  }
  const returnTypeValue = (returnType as { const?: unknown }).const;
  if (!isFunctionReturnType(returnTypeValue)) {
    return null;
  }
  const description = schemaRecord.description;
  return {
    name,
    ...(typeof description === 'string' ? { description } : {}),
    parameters: args as JsonSchema,
    returnType: returnTypeValue,
  };
}

function isFunctionReturnType(
  value: unknown,
): value is A2UIFunctionSpec['returnType'] {
  return value === 'string'
    || value === 'number'
    || value === 'boolean'
    || value === 'array'
    || value === 'object'
    || value === 'any'
    || value === 'void';
}

function componentManifestsFromGeneratedCatalog(
  catalog: unknown,
): CatalogManifest[] {
  if (!isRecord(catalog)) {
    return [];
  }
  const { components } = catalog as { components?: unknown };
  if (!isRecord(components)) {
    return [];
  }
  return Object.entries(components)
    .filter((entry): entry is [string, JsonSchema] => isRecord(entry[1]))
    .map(([name, schema]) => ({ [name]: schema }));
}

export function createA2UICatalogFromManifests(options: {
  catalogId: string;
  componentManifests: Record<string, JsonSchema>[];
  examples?: A2UIExample[];
  extraRules?: string[];
  functions?: A2UIFunctionSpec[];
  label?: string;
  version?: string;
}): A2UICatalog {
  return {
    id: options.catalogId,
    label: options.label ?? `A2UI catalog (${options.catalogId})`,
    ...(options.version ? { version: options.version } : {}),
    components: options.componentManifests
      .map((manifest) => componentFromManifest(manifest))
      .filter((component): component is A2UIComponentSpec =>
        component !== null
      ),
    ...(options.extraRules ? { extraRules: options.extraRules } : {}),
    ...(options.examples ? { examples: options.examples } : {}),
    ...(options.functions ? { functions: options.functions } : {}),
  };
}

export const BASIC_CATALOG: A2UICatalog = {
  id: BASIC_CATALOG_ID,
  label: 'Lynx A2UI basic catalog (v0.9)',
  version: 'v0.9',
  components: componentManifestsFromGeneratedCatalog(generatedCatalog)
    .map((manifest) => componentFromManifest(manifest))
    .filter((component): component is A2UIComponentSpec => component !== null),
  extraRules: [
    'Use only components listed in this catalog; unsupported examples such as Video, AudioPlayer, DatePicker, or Checkbox are not available unless they appear here.',
    'The implemented checkbox component is named "CheckBox" with a capital B.',
  ],
  functions: functionsFromGeneratedCatalog(generatedCatalog),
  examples: BASIC_CATALOG_EXAMPLES,
};

export function renderCatalogReference(catalog: A2UICatalog): string {
  const lines: string[] = [];
  lines.push(
    `## Component catalog (${catalog.label}; catalogId=${catalog.id})`,
  );
  lines.push('');
  for (const c of catalog.components) {
    const required = c.props
      .filter((p) => p.required)
      .map((p) => p.name)
      .join(', ');
    const header = required
      ? `### ${c.name}  (required: ${required})`
      : `### ${c.name}`;
    lines.push(header);
    lines.push(`- ${c.summary}`);
    for (const p of c.props) {
      const req = p.required ? ' [required]' : '';
      const en = p.enums ? `  enum: ${p.enums.join(' | ')}` : '';
      const desc = p.description ? ` — ${p.description}` : '';
      lines.push(`  · ${p.name}: ${p.type}${req}${desc}${en}`);
    }
    if (c.requiresAction) {
      lines.push('  · NOTE: this component MUST include a non-empty `action`.');
    }
    lines.push('');
  }
  if (catalog.extraRules !== undefined && catalog.extraRules.length > 0) {
    lines.push('### Additional catalog rules');
    for (const r of catalog.extraRules) lines.push(`- ${r}`);
    lines.push('');
  }
  if (catalog.functions !== undefined && catalog.functions.length > 0) {
    lines.push('### Available functions');
    for (const fn of catalog.functions) {
      lines.push(`- ${fn.name}: returns ${fn.returnType}`);
      if (fn.description) {
        lines.push(`  ${fn.description}`);
      }
      lines.push(`  parameters: ${JSON.stringify(fn.parameters)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

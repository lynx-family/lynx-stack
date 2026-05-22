// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { BASIC_CATALOG_EXAMPLES } from './a2ui-examples';
import type { A2UIExample } from './a2ui-examples';
import buttonManifest from './catalog/Button/catalog.json';
import cardManifest from './catalog/Card/catalog.json';
import checkBoxManifest from './catalog/CheckBox/catalog.json';
import columnManifest from './catalog/Column/catalog.json';
import dividerManifest from './catalog/Divider/catalog.json';
import iconManifest from './catalog/Icon/catalog.json';
import imageManifest from './catalog/Image/catalog.json';
import lineChartManifest from './catalog/LineChart/catalog.json';
import listManifest from './catalog/List/catalog.json';
import modalManifest from './catalog/Modal/catalog.json';
import radioGroupManifest from './catalog/RadioGroup/catalog.json';
import rowManifest from './catalog/Row/catalog.json';
import sliderManifest from './catalog/Slider/catalog.json';
import tabsManifest from './catalog/Tabs/catalog.json';
import textManifest from './catalog/Text/catalog.json';
import textFieldManifest from './catalog/TextField/catalog.json';

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
}

export const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

export interface JsonSchema {
  type?: string;
  enum?: unknown;
  oneOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  additionalProperties?: unknown;
}

interface CatalogManifest extends Record<string, JsonSchema> {}

const CATALOG_MANIFESTS = [
  textManifest,
  imageManifest,
  iconManifest,
  dividerManifest,
  lineChartManifest,
  rowManifest,
  columnManifest,
  listManifest,
  cardManifest,
  tabsManifest,
  modalManifest,
  buttonManifest,
  textFieldManifest,
  checkBoxManifest,
  radioGroupManifest,
  sliderManifest,
] as const;

const COMPONENT_SUMMARIES: Record<string, string> = {
  Button:
    'Clickable button. MUST always include an action. Has no "label" prop; use a child Text component for the visible label.',
  Card:
    'Card container with exactly one child. Wrap multiple elements in a Column/Row/List first.',
  CheckBox: 'Boolean checkbox with a label and optional validation checks.',
  Column: 'Vertical layout container.',
  Divider: 'Horizontal or vertical separator line.',
  Icon: 'Display an icon by name.',
  Image: 'Display an image by URL.',
  LineChart: 'Display one or more numeric line series over shared labels.',
  List: 'Repeating layout container, commonly bound to a data path.',
  Modal:
    'Modal dialog with a trigger component and a content component. The trigger opens the modal locally when tapped.',
  RadioGroup: 'Single-choice selector for a list of string options.',
  Row: 'Horizontal layout container.',
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

export const BASIC_CATALOG: A2UICatalog = {
  id: BASIC_CATALOG_ID,
  label: 'Lynx A2UI basic catalog (v0.9)',
  version: 'v0.9',
  components: CATALOG_MANIFESTS
    .map((manifest) => componentFromManifest(manifest as CatalogManifest))
    .filter((component): component is A2UIComponentSpec => component !== null),
  extraRules: [
    'Use only components listed in this catalog; unsupported examples such as Video, AudioPlayer, DatePicker, or Checkbox are not available unless they appear here.',
    'The implemented checkbox component is named "CheckBox" with a capital B.',
  ],
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
  return lines.join('\n');
}

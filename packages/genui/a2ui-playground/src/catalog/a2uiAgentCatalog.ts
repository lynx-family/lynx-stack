// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { basicFunctions } from '@lynx-js/genui/a2ui';
import { catalogManifests } from '@lynx-js/genui/a2ui/catalog';

type JsonSchema = Record<string, unknown> & {
  enum?: unknown[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
};

type CatalogManifest = Record<string, JsonSchema>;

export interface A2UIAgentCatalogProp {
  enums?: string[];
  description?: string;
  name: string;
  required?: boolean;
  schema?: JsonSchema;
  type: string;
}

export interface A2UIAgentCatalogComponent {
  containerShape?: 'children' | 'child' | 'tabs' | 'trigger-content' | 'none';
  name: string;
  props: A2UIAgentCatalogProp[];
  requiresAction?: boolean;
  summary: string;
}

export interface A2UIAgentFunctionSpec {
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

export interface A2UIAgentCatalog {
  components: A2UIAgentCatalogComponent[];
  extraRules?: string[];
  functions?: A2UIAgentFunctionSpec[];
  id: string;
  label: string;
  version?: string;
}

const A2UI_PLAYGROUND_CATALOG_ID =
  'https://lynxjs.org/a2ui/catalogs/playground-builtins/v0_9/catalog.json';

const CATALOG_COMPONENT_NAMES = [
  'Text',
  'Image',
  'Row',
  'Column',
  'List',
  'Card',
  'Modal',
  'Button',
  'Divider',
  'Icon',
  'CheckBox',
  'ChoicePicker',
  'DateTimeInput',
  'LineChart',
  'PieChart',
  'Loading',
  'RadioGroup',
  'Slider',
  'TextField',
  'Tabs',
] as const;

const CATALOG_MANIFESTS: readonly CatalogManifest[] = CATALOG_COMPONENT_NAMES
  .map((name) => catalogManifests[name])
  .filter((manifest): manifest is CatalogManifest => manifest !== undefined);

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
  PieChart: 'Display proportional numeric slices as a pie chart.',
  RadioGroup: 'Single-choice selector for a list of string options.',
  Row: 'Horizontal layout container.',
  Slider: 'Numeric slider with an optional label and validation checks.',
  Tabs: 'Tabbed container; each tab references a child component id.',
  Text:
    'Display styled text. Supports literal text, data bindings, and function calls.',
  TextField: 'Single-line or multi-line text input.',
};

const CONTAINER_SHAPES: Partial<
  Record<string, A2UIAgentCatalogComponent['containerShape']>
> = {
  Button: 'child',
  Card: 'child',
  Column: 'children',
  List: 'children',
  Modal: 'trigger-content',
  Row: 'children',
  Tabs: 'tabs',
};

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
): A2UIAgentCatalogComponent | null {
  const [name, schema] = Object.entries(manifest)[0] ?? [];
  if (!name || !schema) return null;

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const props = Object.entries(properties).map(([propName, propSchema]) => {
    const enums = inferEnums(propSchema);
    const description = typeof propSchema.description === 'string'
      ? propSchema.description
      : '';
    return {
      name: propName,
      type: inferType(propSchema),
      schema: propSchema,
      ...(description ? { description } : {}),
      ...(required.has(propName) ? { required: true } : {}),
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

function basicFunctionDefinitions(): A2UIAgentFunctionSpec[] {
  type BasicFunctionDefinition = NonNullable<
    (typeof basicFunctions)[number]['definition']
  >;

  return basicFunctions
    .map((fn) => fn.definition)
    .filter((definition): definition is BasicFunctionDefinition =>
      definition !== undefined
    )
    .map((definition) => ({
      name: definition.name,
      ...(definition.description
        ? { description: definition.description }
        : {}),
      parameters: definition.parameters as JsonSchema,
      returnType: definition.returnType,
    }));
}

export const A2UI_AGENT_CATALOG: A2UIAgentCatalog = {
  id: A2UI_PLAYGROUND_CATALOG_ID,
  label: 'Lynx A2UI playground built-in catalog (v0.9)',
  version: 'v0.9',
  components: CATALOG_MANIFESTS
    .map((manifest) => componentFromManifest(manifest))
    .filter((component): component is A2UIAgentCatalogComponent =>
      component !== null
    ),
  functions: basicFunctionDefinitions(),
  extraRules: [
    'Use only components listed in this catalog; unsupported examples such as Video, AudioPlayer, DatePicker, or Checkbox are not available unless they appear here.',
    'The implemented checkbox component is named "CheckBox" with a capital B.',
  ],
};

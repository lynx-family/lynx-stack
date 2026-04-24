// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export const GENERIC_PROPS: ReadonlySet<string> = new Set([
  'id',
  'surface',
  'setValue',
  'sendAction',
  'dataContextPath',
  '__template',
  'component',
]);

export const ALLOWED_SCHEMA_OVERRIDE_KEYS: ReadonlySet<string> = new Set([
  'additionalProperties',
  'const',
  'default',
  'deprecated',
  'description',
  'enum',
  'items',
  'oneOf',
  'properties',
  'required',
  'type',
]);

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
  [key: string]: JsonValue;
};

export interface JsonSchema {
  additionalProperties?: boolean | JsonSchema;
  const?: JsonValue;
  default?: JsonValue;
  deprecated?: boolean;
  description?: string;
  enum?: JsonPrimitive[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: 'array' | 'boolean' | 'number' | 'object' | 'string';
}

export interface ComponentSchema {
  properties: Record<string, JsonSchema>;
  required: string[];
}

export interface CatalogComponent {
  entryFile: string;
  name: string;
  schema: ComponentSchema;
}

export type CatalogFormat = 'a2ui-catalog' | 'legacy-shards';

export interface ExtractCatalogOptions {
  catalogId?: string;
  components?: string[];
  description?: string;
  format?: CatalogFormat;
  functions?: Record<string, JsonSchema>;
  schema?: string;
  sourceDir: string;
  theme?: Record<string, JsonValue>;
  title?: string;
  tsconfigPath?: string;
}

export interface ExtractCatalogResult {
  catalog?: Record<string, JsonValue>;
  components: CatalogComponent[];
  format: CatalogFormat;
}

export interface CatalogFile {
  content: string;
  path: string;
}

export interface RenderCatalogFilesOptions {
  outDir: string;
}

export interface CheckCatalogFilesResult {
  actual?: string;
  expected?: string;
  missing: string[];
  mismatched: string[];
  ok: boolean;
}

export interface LoadCatalogConfigResult {
  config: Record<string, JsonValue>;
  path: string;
}

export interface PropertyDoc {
  defaultValue?: JsonValue;
  deprecated?: boolean;
  description?: string;
  schemaOverride?: JsonSchema;
}

export interface TypeDocRecord {
  description?: string;
  properties: Map<string, PropertyDoc>;
}

export interface TypeDocIndex {
  types: Map<string, TypeDocRecord>;
}

export interface JsDocTypedefProperty {
  description?: string;
  name: string;
  optional: boolean;
  typeExpression: string;
}

export interface JsDocTypedef {
  description?: string;
  name: string;
  properties: JsDocTypedefProperty[];
  typeExpression?: string;
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  createA2UICatalogFromManifests,
} from '../../server/agent/a2ui-catalog.js';
import type {
  A2UICatalog,
  A2UIFunctionSpec,
  JsonSchema,
} from '../../server/agent/a2ui-catalog.js';

export * from '../../server/agent/a2ui-catalog.js';
export * from '../../server/agent/a2ui-examples.js';
export * from '../../server/agent/a2ui-prompt.js';

export interface ReadA2UICatalogDirectoryOptions {
  catalogDir: string;
  catalogId: string;
  cwd?: string;
  label?: string;
  version?: string;
}

export function readA2UICatalogFromDirectory(
  options: ReadA2UICatalogDirectoryOptions,
): A2UICatalog {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const catalogDir = path.resolve(cwd, options.catalogDir);
  if (!fs.existsSync(catalogDir)) {
    throw new Error(
      `[a2ui-prompt] Catalog directory does not exist: ${options.catalogDir}`,
    );
  }
  if (!fs.statSync(catalogDir).isDirectory()) {
    throw new Error(
      `[a2ui-prompt] Catalog path is not a directory: ${options.catalogDir}`,
    );
  }

  const fullCatalog = readFullCatalog(catalogDir);
  if (fullCatalog) {
    const componentManifests = componentManifestsFromFullCatalog(fullCatalog);
    if (componentManifests.length === 0) {
      throw new Error(
        `[a2ui-prompt] Full catalog for ${options.catalogId} did not contain any valid component schemas.`,
      );
    }
    return createA2UICatalogFromManifests({
      catalogId: options.catalogId,
      componentManifests,
      functions: functionDefinitionsFromFullCatalog(fullCatalog),
      ...(options.label ? { label: options.label } : {}),
      ...(options.version ? { version: options.version } : {}),
    });
  }

  const componentManifests: Record<string, JsonSchema>[] = [];
  const componentCatalogDir = resolveComponentCatalogDir(catalogDir);
  for (
    const entry of fs.readdirSync(componentCatalogDir, { withFileTypes: true })
  ) {
    if (!entry.isDirectory() || entry.name === 'functions') {
      continue;
    }
    const catalogJsonPath = path.join(
      componentCatalogDir,
      entry.name,
      'catalog.json',
    );
    if (fs.existsSync(catalogJsonPath)) {
      componentManifests.push(readCatalogManifest(catalogJsonPath));
    }
  }
  if (componentManifests.length === 0) {
    throw new Error(
      `[a2ui-prompt] No component catalog files found in ${options.catalogDir}. Expected a full catalog.json or files like catalog/<Component>/catalog.json. Run "genui a2ui generate catalog" first or pass --catalog-dir to the generated catalog directory.`,
    );
  }

  return createA2UICatalogFromManifests({
    catalogId: options.catalogId,
    componentManifests,
    ...(options.label ? { label: options.label } : {}),
    ...(options.version ? { version: options.version } : {}),
  });
}

function readFullCatalog(catalogDir: string): Record<string, unknown> | null {
  const candidates = [
    path.join(catalogDir, 'catalog.json'),
    path.join(path.dirname(catalogDir), 'catalog.json'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const catalog = readJsonObject(candidate);
    if (isRecord(catalog['components'])) {
      return catalog;
    }
  }
  return null;
}

function resolveComponentCatalogDir(catalogDir: string): string {
  const nestedCatalogDir = path.join(catalogDir, 'catalog');
  if (
    fs.existsSync(nestedCatalogDir)
    && fs.statSync(nestedCatalogDir).isDirectory()
  ) {
    return nestedCatalogDir;
  }
  return catalogDir;
}

function componentManifestsFromFullCatalog(
  catalog: Record<string, unknown>,
): Record<string, JsonSchema>[] {
  const components = catalog['components'];
  if (!isRecord(components)) {
    return [];
  }
  return Object.entries(components)
    .filter((entry): entry is [string, JsonSchema] => isRecord(entry[1]))
    .map(([name, schema]) => ({ [name]: schema }));
}

function functionDefinitionsFromFullCatalog(
  catalog: Record<string, unknown>,
): A2UIFunctionSpec[] {
  const functions = catalog['functions'];
  if (isRecord(functions)) {
    return Object.entries(functions)
      .map(([name, schema]) => functionSpecFromSchema(name, schema))
      .filter((fn): fn is A2UIFunctionSpec => fn !== null)
      .sort((left, right) => left.name.localeCompare(right.name));
  }
  if (!Array.isArray(functions)) {
    return [];
  }
  return functions
    .filter((fn): fn is A2UIFunctionSpec =>
      isRecord(fn)
      && typeof fn['name'] === 'string'
      && isRecord(fn['parameters'])
      && isReturnType(fn['returnType'])
    )
    .sort((left, right) => left.name.localeCompare(right.name));
}

function functionSpecFromSchema(
  name: string,
  schema: unknown,
): A2UIFunctionSpec | null {
  if (!isRecord(schema) || !isRecord(schema['properties'])) {
    return null;
  }
  const properties = schema['properties'];
  const args = properties['args'];
  const returnType = properties['returnType'];
  if (!isRecord(args) || !isRecord(returnType)) {
    return null;
  }
  const returnTypeValue = returnType['const'];
  if (!isReturnType(returnTypeValue)) {
    return null;
  }
  const description = schema['description'];
  return {
    name,
    ...(typeof description === 'string' ? { description } : {}),
    parameters: args as JsonSchema,
    returnType: returnTypeValue,
  };
}

function readJsonObject(filePath: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(value)) {
    throw new Error(`[a2ui-prompt] Expected JSON object in ${filePath}.`);
  }
  return value;
}

function readCatalogManifest(filePath: string): Record<string, JsonSchema> {
  const manifest = readJsonObject(filePath);
  const keys = Object.keys(manifest);
  if (keys.length !== 1) {
    throw new Error(
      `[a2ui-prompt] Expected exactly one component manifest in ${filePath}, found ${keys.length}.`,
    );
  }
  const componentName = keys[0]!;
  const schema = manifest[componentName];
  if (!isRecord(schema)) {
    throw new Error(
      `[a2ui-prompt] Expected JSON schema object for ${componentName} in ${filePath}.`,
    );
  }
  return { [componentName]: schema as JsonSchema };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isReturnType(value: unknown): value is A2UIFunctionSpec['returnType'] {
  return value === 'string'
    || value === 'number'
    || value === 'boolean'
    || value === 'array'
    || value === 'object'
    || value === 'any'
    || value === 'void';
}

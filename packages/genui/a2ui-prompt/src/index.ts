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

  const componentManifests: Record<string, JsonSchema>[] = [];
  for (const entry of fs.readdirSync(catalogDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'functions') {
      continue;
    }
    const catalogJsonPath = path.join(catalogDir, entry.name, 'catalog.json');
    if (fs.existsSync(catalogJsonPath)) {
      componentManifests.push(readCatalogManifest(catalogJsonPath));
    }
  }
  if (componentManifests.length === 0) {
    throw new Error(
      `[a2ui-prompt] No component catalog files found in ${options.catalogDir}. Expected files like <Component>/catalog.json. Run "a2ui-cli generate catalog" first or pass --catalog-dir to the generated catalog directory.`,
    );
  }

  return createA2UICatalogFromManifests({
    catalogId: options.catalogId,
    componentManifests,
    functions: readFunctionDefinitions(catalogDir),
    ...(options.label ? { label: options.label } : {}),
    ...(options.version ? { version: options.version } : {}),
  });
}

function readFunctionDefinitions(catalogDir: string): A2UIFunctionSpec[] {
  const functionsDir = path.join(catalogDir, 'functions');
  if (!fs.existsSync(functionsDir)) {
    return [];
  }
  if (!fs.statSync(functionsDir).isDirectory()) {
    throw new Error(
      `[a2ui-prompt] Expected functions directory at ${functionsDir}.`,
    );
  }

  const functions: A2UIFunctionSpec[] = [];
  for (const entry of fs.readdirSync(functionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }
    const functionRecord = readJsonObject(path.join(functionsDir, entry.name));
    for (const [name, value] of Object.entries(functionRecord)) {
      if (!isRecord(value)) {
        continue;
      }
      const description = value['description'];
      const parameters = value['parameters'];
      const returnType = value['returnType'];
      functions.push({
        name,
        ...(typeof description === 'string' ? { description } : {}),
        parameters: isRecord(parameters)
          ? parameters as JsonSchema
          : { type: 'object', properties: {}, additionalProperties: false },
        returnType: isReturnType(returnType) ? returnType : 'any',
      });
    }
  }

  return functions.sort((left, right) => left.name.localeCompare(right.name));
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

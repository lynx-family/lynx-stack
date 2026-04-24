// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import {
  Application,
  Comment,
  type Comment as TypeDocComment,
  type DeclarationReflection,
  OptionDefaults,
  ReflectionKind,
  TSConfigReader,
  TypeDocReader,
  type TypeDocOptions,
} from 'typedoc';

import {
  ALLOWED_SCHEMA_OVERRIDE_KEYS,
  type JsDocTypedef,
  type JsonSchema,
  type JsonValue,
  type PropertyDoc,
  type TypeDocIndex,
  type TypeDocRecord,
} from './types.ts';

const PROTOTYPE_POLLUTION_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

const JSON_SCHEMA_TYPES = new Set<NonNullable<JsonSchema['type']>>([
  'array',
  'boolean',
  'number',
  'object',
  'string',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function stripDocCodeFences(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/^```[A-Za-z0-9_-]*\n([\s\S]*?)\n```$/u);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function combineCommentSections(comment?: TypeDocComment): string | undefined {
  if (!comment) return undefined;

  const summary = normalizeWhitespace(
    Comment.combineDisplayParts(comment.summary),
  );
  const remarks = normalizeWhitespace(
    Comment.combineDisplayParts(comment.getTag?.('@remarks')?.content),
  );

  if (summary && remarks) {
    return `${summary}\n\n${remarks}`;
  }

  return summary || remarks || undefined;
}

function parseScalarToken(
  value: string,
  context: string,
): JsonValue | undefined {
  const trimmed = stripDocCodeFences(value);
  if (!trimmed) return undefined;

  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'undefined') {
    throw new Error(
      `The literal "undefined" is not supported in ${context}. Omit the tag instead.`,
    );
  }

  if (/^-?\d+(\.\d+)?$/u.test(trimmed)) {
    return Number(trimmed);
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'))
    || (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed) as JsonValue;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse ${context} value ${trimmed}: ${message}`,
      );
    }
  }

  if (trimmed.startsWith('\'') && trimmed.endsWith('\'')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function validateSchemaValue(
  value: unknown,
  context: string,
): asserts value is JsonSchema {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`@a2uiSchema ${context} must be a JSON object.`);
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      throw new Error(`@a2uiSchema ${context} uses forbidden key "${key}".`);
    }
    if (!ALLOWED_SCHEMA_OVERRIDE_KEYS.has(key)) {
      throw new Error(
        `@a2uiSchema ${context} uses unsupported key "${key}".`,
      );
    }

    switch (key) {
      case 'additionalProperties': {
        if (typeof nestedValue === 'boolean') continue;
        validateSchemaValue(nestedValue, `${context}.additionalProperties`);
        continue;
      }

      case 'items': {
        validateSchemaValue(nestedValue, `${context}.items`);
        continue;
      }

      case 'oneOf': {
        if (!Array.isArray(nestedValue)) {
          throw new Error(`@a2uiSchema ${context}.oneOf must be an array.`);
        }
        nestedValue.forEach((entry, index) => {
          validateSchemaValue(entry, `${context}.oneOf[${index}]`);
        });
        continue;
      }

      case 'properties': {
        if (
          typeof nestedValue !== 'object'
          || nestedValue === null
          || Array.isArray(nestedValue)
        ) {
          throw new Error(
            `@a2uiSchema ${context}.properties must be an object.`,
          );
        }
        for (const [propName, propValue] of Object.entries(nestedValue)) {
          if (PROTOTYPE_POLLUTION_KEYS.has(propName)) {
            throw new Error(
              `@a2uiSchema ${context}.properties uses forbidden key "${propName}".`,
            );
          }
          validateSchemaValue(propValue, `${context}.properties.${propName}`);
        }
        continue;
      }

      case 'required': {
        if (
          !Array.isArray(nestedValue)
          || nestedValue.some(entry => typeof entry !== 'string')
        ) {
          throw new Error(
            `@a2uiSchema ${context}.required must be a string array.`,
          );
        }
        continue;
      }

      case 'enum': {
        if (
          !Array.isArray(nestedValue)
          || nestedValue.some(entry =>
            entry !== null
            && typeof entry !== 'boolean'
            && typeof entry !== 'number'
            && typeof entry !== 'string'
          )
        ) {
          throw new Error(
            `@a2uiSchema ${context}.enum must contain only JSON primitive values.`,
          );
        }
        continue;
      }

      case 'const':
      case 'default':
      case 'deprecated':
      case 'description':
        continue;

      case 'type': {
        if (
          typeof nestedValue !== 'string'
          || !JSON_SCHEMA_TYPES.has(
            nestedValue as NonNullable<JsonSchema['type']>,
          )
        ) {
          throw new Error(
            `@a2uiSchema ${context}.type must be one of array|boolean|number|object|string.`,
          );
        }
        continue;
      }

      default:
        throw new Error(`Unsupported schema override key: ${String(key)}`);
    }
  }
}

export function parseSchemaOverride(text: string): JsonSchema {
  const trimmed = stripDocCodeFences(text);
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    throw new Error('@a2uiSchema must be a strict JSON object fragment.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse @a2uiSchema JSON fragment ${trimmed}: ${message}`,
    );
  }
  validateSchemaValue(parsed, 'root');
  return parsed;
}

function buildPropertyDoc(reflection: DeclarationReflection): PropertyDoc {
  const defaultValueTag = reflection.comment?.getTag('@defaultValue');
  const defaultTag = defaultValueTag ?? reflection.comment?.getTag('@default');
  const schemaTag = reflection.comment?.getTag('@a2uiSchema');

  const doc: PropertyDoc = {};
  const defaultValue = defaultTag
    ? parseScalarToken(
      Comment.combineDisplayParts(defaultTag.content),
      defaultValueTag ? '@defaultValue' : '@default',
    )
    : undefined;
  const description = combineCommentSections(reflection.comment);
  const schemaOverrideText = schemaTag
    ? stripDocCodeFences(Comment.combineDisplayParts(schemaTag.content))
    : undefined;
  const schemaOverride = schemaOverrideText
    ? parseSchemaOverride(schemaOverrideText)
    : undefined;

  if (defaultValue !== undefined) {
    doc.defaultValue = defaultValue;
  }
  if (reflection.comment?.getTag('@deprecated')) {
    doc.deprecated = true;
  }
  if (description) {
    doc.description = description;
  }
  if (schemaOverride) {
    doc.schemaOverride = schemaOverride;
  }

  return doc;
}

function buildTypeRecord(
  reflection: DeclarationReflection,
  children: readonly DeclarationReflection[],
): TypeDocRecord {
  const properties = new Map<string, PropertyDoc>();

  for (const child of children) {
    properties.set(child.name, buildPropertyDoc(child));
  }

  const record: TypeDocRecord = {
    properties,
  };
  const description = combineCommentSections(reflection.comment);
  if (description) {
    record.description = description;
  }
  return record;
}

function getPrimarySourceFile(
  reflection: DeclarationReflection,
): string | undefined {
  return reflection.sources?.[0]?.fullFileName;
}

function getTypeDocKey(filePath: string, name: string): string {
  return `${path.resolve(filePath)}::${name}`;
}

function getTypeAliasChildren(
  reflection: DeclarationReflection,
): DeclarationReflection[] {
  const declarationLike = (reflection.type as {
    declaration?: DeclarationReflection;
  } | undefined)?.declaration;
  return declarationLike?.children ?? [];
}

export async function buildTypeDocIndex(
  entryPoints: readonly string[],
  tsconfigPath?: string,
): Promise<TypeDocIndex> {
  const bootstrapOptions: TypeDocOptions = {
    blockTags: [
      ...new Set([
        ...OptionDefaults.blockTags,
        '@a2uiSchema',
      ]),
    ] as `@${string}`[],
    commentStyle: 'all',
    emit: 'none',
    entryPoints: [...entryPoints],
    excludeTags: [...OptionDefaults.excludeTags],
    inlineTags: [...OptionDefaults.inlineTags],
    modifierTags: [...OptionDefaults.modifierTags],
    plugin: [],
    readme: 'none',
    skipErrorChecking: true,
  };
  if (tsconfigPath) {
    Object.assign(bootstrapOptions, { tsconfig: tsconfigPath });
  }

  const app = await Application.bootstrap(
    bootstrapOptions,
    [new TSConfigReader(), new TypeDocReader()],
  );

  const project = await app.convert();
  if (!project) {
    throw new Error('TypeDoc could not convert the provided entry points.');
  }

  const index: TypeDocIndex = {
    types: new Map<string, TypeDocRecord>(),
  };

  for (
    const reflection of project.getReflectionsByKind(
      ReflectionKind.Interface,
    ) as DeclarationReflection[]
  ) {
    const sourceFile = getPrimarySourceFile(reflection);
    if (!sourceFile) continue;
    index.types.set(
      getTypeDocKey(sourceFile, reflection.name),
      buildTypeRecord(reflection, reflection.children ?? []),
    );
  }

  for (
    const reflection of project.getReflectionsByKind(
      ReflectionKind.TypeAlias,
    ) as DeclarationReflection[]
  ) {
    const sourceFile = getPrimarySourceFile(reflection);
    if (!sourceFile) continue;
    index.types.set(
      getTypeDocKey(sourceFile, reflection.name),
      buildTypeRecord(reflection, getTypeAliasChildren(reflection)),
    );
  }

  return index;
}

export function getTypeDocRecord(
  index: TypeDocIndex,
  filePath: string,
  typeName: string,
): TypeDocRecord | undefined {
  return index.types.get(getTypeDocKey(filePath, typeName));
}

export function parseJsDocTypedefs(
  sourceText: string,
): Map<string, JsDocTypedef> {
  const typedefs = new Map<string, JsDocTypedef>();
  const blockPattern = /\/\*\*([\s\S]*?)\*\//gu;

  for (const match of sourceText.matchAll(blockPattern)) {
    const block = match[1] ?? '';
    const lines = block
      .split('\n')
      .map(line => line.replace(/^\s*\*\s?/u, '').trim())
      .filter(Boolean);

    const typedefLine = lines.find(line => line.startsWith('@typedef '));
    if (!typedefLine) continue;

    const typedefMatch = typedefLine.match(
      /^@typedef\s+\{(?<type>.+)\}\s+(?<name>[A-Za-z_$][\w$]*)(?:\s+(?<description>.+))?$/u,
    );
    if (!typedefMatch?.groups) continue;

    const typedef: JsDocTypedef = {
      name: typedefMatch.groups['name']!,
      properties: [],
    };
    const typedefDescription = typedefMatch.groups['description']?.trim();
    const typedefTypeExpression = typedefMatch.groups['type']?.trim();
    if (typedefDescription) {
      typedef.description = typedefDescription;
    }
    if (typedefTypeExpression) {
      typedef.typeExpression = typedefTypeExpression;
    }

    for (const line of lines) {
      if (!line.startsWith('@property ')) continue;
      const propertyMatch = line.match(
        /^@property\s+\{(?<type>.+)\}\s+(?<name>\[[^\]]+\]|[A-Za-z_$][\w$]*)(?:\s+(?<description>.+))?$/u,
      );
      if (!propertyMatch?.groups) continue;

      const rawName = propertyMatch.groups['name']!;
      const optional = rawName.startsWith('[') && rawName.endsWith(']');
      const propertyName = optional ? rawName.slice(1, -1) : rawName;

      const property: JsDocTypedef['properties'][number] = {
        name: propertyName,
        optional,
        typeExpression: propertyMatch.groups['type']!.trim(),
      };
      const propertyDescription = propertyMatch.groups['description']?.trim();
      if (propertyDescription) {
        property.description = propertyDescription;
      }
      typedef.properties.push(property);
    }

    typedefs.set(typedef.name, typedef);
  }

  return typedefs;
}

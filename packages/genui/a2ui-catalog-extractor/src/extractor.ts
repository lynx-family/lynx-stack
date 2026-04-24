// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as ts from 'typescript';

import {
  buildTypeDocIndex,
  getTypeDocRecord,
  parseSchemaOverride,
  parseJsDocTypedefs,
} from './docs.ts';
import {
  GENERIC_PROPS,
  type CatalogComponent,
  type CatalogFile,
  type CheckCatalogFilesResult,
  type ComponentSchema,
  type ExtractCatalogOptions,
  type ExtractCatalogResult,
  type JsDocTypedef,
  type JsonSchema,
  type JsonValue,
  type LoadCatalogConfigResult,
  type PropertyDoc,
  type RenderCatalogFilesOptions,
  type TypeDocIndex,
  type TypeDocRecord,
} from './types.ts';

interface SourceContext {
  filePath: string;
  jsDocTypedefs: Map<string, JsDocTypedef>;
  localDeclarations: Map<string, LocalDeclaration>;
  sourceFile: ts.SourceFile;
  typeDocIndex: TypeDocIndex;
}

type LocalDeclaration =
  | {
    kind: 'interface';
    node: ts.InterfaceDeclaration;
  }
  | {
    kind: 'typeAlias';
    node: ts.TypeAliasDeclaration;
  }
  | {
    kind: 'typedef';
    typedef: JsDocTypedef;
  };

type TypeLikeNode = ts.TypeNode;

interface ParseState {
  seen: Set<string>;
}

interface PropertyDefinition {
  doc?: PropertyDoc;
  name: string;
  optional: boolean;
  typeNode: TypeLikeNode;
}

interface CollectedTypeElements {
  additionalProperties?: JsonSchema | boolean;
  properties: PropertyDefinition[];
}

function inferScriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filePath.endsWith('.ts')) return ts.ScriptKind.TS;
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function hasExportModifier(node: ts.Node): boolean {
  return Boolean(
    ts.canHaveModifiers(node)
      && ts.getModifiers(node)?.some(modifier =>
        modifier.kind === ts.SyntaxKind.ExportKeyword
      ),
  );
}

function getComponentDeclarations(sourceFile: ts.SourceFile): {
  name: string;
  parameter: ts.ParameterDeclaration;
}[] {
  const components: {
    name: string;
    parameter: ts.ParameterDeclaration;
  }[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement)
      && hasExportModifier(statement)
      && statement.name
      && statement.parameters.length > 0
    ) {
      components.push({
        name: statement.name.text,
        parameter: statement.parameters[0]!,
      });
      continue;
    }

    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) continue;
      if (
        !declaration.initializer
        || (
          !ts.isArrowFunction(declaration.initializer)
          && !ts.isFunctionExpression(declaration.initializer)
        )
        || declaration.initializer.parameters.length === 0
      ) {
        continue;
      }

      components.push({
        name: declaration.name.text,
        parameter: declaration.initializer.parameters[0]!,
      });
    }
  }

  return components;
}

function collectLocalDeclarations(
  sourceFile: ts.SourceFile,
  jsDocTypedefs: Map<string, JsDocTypedef>,
): Map<string, LocalDeclaration> {
  const declarations = new Map<string, LocalDeclaration>();

  for (const statement of sourceFile.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      declarations.set(statement.name.text, {
        kind: 'interface',
        node: statement,
      });
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      declarations.set(statement.name.text, {
        kind: 'typeAlias',
        node: statement,
      });
    }
  }

  for (const [name, typedef] of jsDocTypedefs) {
    declarations.set(name, {
      kind: 'typedef',
      typedef,
    });
  }

  return declarations;
}

function parseTypeExpressionString(
  typeExpression: string,
): ts.TypeNode | undefined {
  const sourceText = `type __A2UI = ${typeExpression};`;
  const sourceFile = ts.createSourceFile(
    '__a2ui_type__.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const statement = sourceFile.statements[0];
  if (!statement || !ts.isTypeAliasDeclaration(statement)) {
    return undefined;
  }
  return statement.type;
}

function getParameterTypeNode(
  parameter: ts.ParameterDeclaration,
): TypeLikeNode | undefined {
  return parameter.type ?? ts.getJSDocType(parameter);
}

function isNullLikeTypeNode(typeNode: TypeLikeNode): boolean {
  if (typeNode.kind === ts.SyntaxKind.NullKeyword) return true;
  return ts.isLiteralTypeNode(typeNode)
    && typeNode.literal.kind === ts.SyntaxKind.NullKeyword;
}

function isUndefinedLikeTypeNode(typeNode: TypeLikeNode): boolean {
  return typeNode.kind === ts.SyntaxKind.UndefinedKeyword;
}

function isBooleanLiteralTypeNode(typeNode: TypeLikeNode): boolean {
  return ts.isLiteralTypeNode(typeNode)
    && (
      typeNode.literal.kind === ts.SyntaxKind.TrueKeyword
      || typeNode.literal.kind === ts.SyntaxKind.FalseKeyword
    );
}

function isStringLiteralTypeNode(
  typeNode: TypeLikeNode,
): typeNode is ts.LiteralTypeNode {
  return ts.isLiteralTypeNode(typeNode)
    && ts.isStringLiteral(typeNode.literal);
}

function isStringIndexKeyType(typeNode: TypeLikeNode): boolean {
  return typeNode.kind === ts.SyntaxKind.StringKeyword
    || isStringLiteralTypeNode(typeNode);
}

function dedupeSchemas(schemas: JsonSchema[]): JsonSchema[] {
  const deduped: JsonSchema[] = [];

  for (const schema of schemas) {
    const serialized = JSON.stringify(schema);
    if (deduped.some(existing => JSON.stringify(existing) === serialized)) {
      continue;
    }
    deduped.push(schema);
  }

  return deduped;
}

function applyPropertyDoc(schema: JsonSchema, doc?: PropertyDoc): JsonSchema {
  if (!doc) return schema;

  const next: JsonSchema = { ...schema };

  if (doc.description) {
    next.description = doc.description;
  }
  if (doc.defaultValue !== undefined) {
    next.default = doc.defaultValue;
  }
  if (doc.deprecated) {
    next.deprecated = true;
  }

  return doc.schemaOverride
    ? mergeSchema(next, doc.schemaOverride)
    : next;
}

function mergePropertyDoc(
  base: PropertyDoc | undefined,
  overlay: PropertyDoc | undefined,
): PropertyDoc | undefined {
  if (!base) return overlay;
  if (!overlay) return base;
  return {
    ...base,
    ...overlay,
  };
}

function normalizeJsDocComment(
  comment:
    | string
    | readonly (
      | ts.JSDocText
      | ts.JSDocLink
      | ts.JSDocLinkCode
      | ts.JSDocLinkPlain
    )[]
    | undefined,
): string | undefined {
  if (!comment) return undefined;
  if (typeof comment === 'string') {
    return comment.trim() || undefined;
  }

  const combined = comment.map(part => part.text).join('').trim();
  return combined || undefined;
}

function getAstPropertyDoc(node: ts.Node): PropertyDoc | undefined {
  let schemaOverride: JsonSchema | undefined;

  for (const tag of ts.getJSDocTags(node)) {
    if (tag.tagName.text !== 'a2uiSchema') continue;

    const tagComment = normalizeJsDocComment(tag.comment);
    if (!tagComment) {
      throw new Error('@a2uiSchema must include a JSON object fragment.');
    }
    schemaOverride = parseSchemaOverride(tagComment);
  }

  if (!schemaOverride) {
    return undefined;
  }

  return {
    schemaOverride,
  };
}

function mergeSchema(base: JsonSchema, override: JsonSchema): JsonSchema {
  const merged: JsonSchema = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const current = (merged as Record<string, unknown>)[key];
    if (
      current
      && value
      && typeof current === 'object'
      && typeof value === 'object'
      && !Array.isArray(current)
      && !Array.isArray(value)
    ) {
      (merged as Record<string, unknown>)[key] = mergeSchema(
        current as JsonSchema,
        value as JsonSchema,
      );
      continue;
    }
    (merged as Record<string, unknown>)[key] = value;
  }

  return merged;
}

function buildObjectSchema(
  properties: PropertyDefinition[],
  context: SourceContext,
  parseState: ParseState,
  topLevel: boolean,
  typeDocRecord?: TypeDocRecord,
  explicitAdditionalProperties?: JsonSchema | boolean,
): JsonSchema | ComponentSchema {
  const schema: JsonSchema = topLevel ? {} : { type: 'object' };
  const propertyMap: Record<string, JsonSchema> = {};
  const required: string[] = [];
  const additionalProperties = explicitAdditionalProperties;

  for (const property of properties) {
    if (GENERIC_PROPS.has(property.name)) continue;

    const doc = property.doc ?? typeDocRecord?.properties.get(property.name);
    const propertySchema = applyPropertyDoc(
      parseTypeNode(property.typeNode, context, parseState),
      doc,
    );

    propertyMap[property.name] = propertySchema;
    if (!property.optional) {
      required.push(property.name);
    }
  }

  const propertyNames = Object.keys(propertyMap);
  if (propertyNames.length > 0) {
    schema.properties = propertyMap;
  } else if (topLevel) {
    schema.properties = {};
  }

  if (topLevel) {
    return {
      properties: schema.properties ?? {},
      required,
    };
  }

  if (propertyNames.length === 0 && additionalProperties === undefined) {
    return { type: 'object' };
  }

  if (propertyNames.length > 0) {
    schema.required = required;
  } else if (required.length > 0) {
    schema.required = required;
  }

  if (additionalProperties === undefined) {
    if (propertyNames.length > 0) {
      schema.additionalProperties = false;
    }
  } else {
    schema.additionalProperties = additionalProperties;
  }

  return schema;
}

function getTypeReferenceName(
  typeNode: ts.TypeReferenceNode,
): string | undefined {
  if (ts.isIdentifier(typeNode.typeName)) {
    return typeNode.typeName.text;
  }
  return undefined;
}

function parseSyntheticTypedef(
  typedef: JsDocTypedef,
  context: SourceContext,
  parseState: ParseState,
  topLevel: boolean,
): JsonSchema | ComponentSchema {
  if (typedef.properties.length === 0) {
    if (!typedef.typeExpression || typedef.typeExpression === 'object') {
      return topLevel
        ? { properties: {}, required: [] }
        : { type: 'object' };
    }

    const typeNode = parseTypeExpressionString(typedef.typeExpression);
    if (!typeNode) {
      throw new Error(
        `Could not parse JSDoc typedef "${typedef.name}" in ${context.filePath}.`,
      );
    }

    return parseTypeNode(typeNode, context, parseState);
  }

  const properties: PropertyDefinition[] = [];
  for (const property of typedef.properties) {
    const typeNode = parseTypeExpressionString(property.typeExpression);
    if (!typeNode) {
      throw new Error(
        `Could not parse JSDoc property "${typedef.name}.${property.name}" in ${context.filePath}.`,
      );
    }
    properties.push({
      name: property.name,
      optional: property.optional,
      typeNode,
    });
    if (property.description) {
      properties[properties.length - 1]!.doc = {
        description: property.description,
      };
    }
  }

  return buildObjectSchema(properties, context, parseState, topLevel);
}

function getPropertyName(member: ts.TypeElement): string | undefined {
  if (
    (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member))
    && member.name
  ) {
    if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
      return member.name.text;
    }
  }
  return undefined;
}

function getPropertyTypeNode(member: ts.TypeElement): TypeLikeNode | undefined {
  if (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member)) {
    return member.type ?? ts.getJSDocType(member);
  }
  return undefined;
}

function isOptionalProperty(
  member: ts.TypeElement,
  typeNode: TypeLikeNode,
): boolean {
  if (
    (ts.isPropertySignature(member) || ts.isPropertyDeclaration(member))
    && member.questionToken
  ) {
    return true;
  }

  return ts.isUnionTypeNode(typeNode)
    && typeNode.types.some(type => isUndefinedLikeTypeNode(type));
}

function collectInterfaceProperties(
  declaration: ts.InterfaceDeclaration,
  context: SourceContext,
  parseState: ParseState,
): CollectedTypeElements {
  const typeDocRecord = getTypeDocRecord(
    context.typeDocIndex,
    context.filePath,
    declaration.name.text,
  );

  return collectTypeElementProperties(
    declaration.members,
    context,
    parseState,
    typeDocRecord,
  );
}

function parseNamedDeclaration(
  name: string,
  declaration: LocalDeclaration,
  context: SourceContext,
  parseState: ParseState,
  topLevel: boolean,
): JsonSchema | ComponentSchema {
  const cacheKey = `${context.filePath}::${name}`;
  if (parseState.seen.has(cacheKey)) {
    return topLevel ? { properties: {}, required: [] } : { type: 'object' };
  }

  parseState.seen.add(cacheKey);
  try {
    switch (declaration.kind) {
      case 'interface': {
        const typeDocRecord = getTypeDocRecord(
          context.typeDocIndex,
          context.filePath,
          declaration.node.name.text,
        );
        const collected = collectInterfaceProperties(
          declaration.node,
          context,
          parseState,
        );
        return buildObjectSchema(
          collected.properties,
          context,
          parseState,
          topLevel,
          typeDocRecord,
          collected.additionalProperties,
        );
      }

      case 'typeAlias': {
        if (ts.isTypeLiteralNode(declaration.node.type)) {
          const typeDocRecord = getTypeDocRecord(
            context.typeDocIndex,
            context.filePath,
            declaration.node.name.text,
          );

          const properties: PropertyDefinition[] = [];
          const collected = collectTypeElementProperties(
            declaration.node.type.members,
            context,
            parseState,
            typeDocRecord,
          );
          properties.push(...collected.properties);

          return buildObjectSchema(
            properties,
            context,
            parseState,
            topLevel,
            typeDocRecord,
            collected.additionalProperties,
          );
        }

        return parseTypeNode(declaration.node.type, context, parseState);
      }

      case 'typedef':
        return parseSyntheticTypedef(
          declaration.typedef,
          context,
          parseState,
          topLevel,
        );
    }
  } finally {
    parseState.seen.delete(cacheKey);
  }
}

function parseRecordTypeReference(
  typeNode: ts.TypeReferenceNode,
  context: SourceContext,
  parseState: ParseState,
): JsonSchema | undefined {
  const typeName = getTypeReferenceName(typeNode);
  const typeArguments = typeNode.typeArguments;

  if (
    (typeName === 'Array' || typeName === 'ReadonlyArray')
    && typeArguments?.[0]
  ) {
    return {
      type: 'array',
      items: parseTypeNode(typeArguments[0], context, parseState),
    };
  }

  if (
    typeName === 'Record'
    && typeArguments?.[0]
    && typeArguments[1]
    && isStringIndexKeyType(typeArguments[0])
  ) {
    return {
      type: 'object',
      additionalProperties: parseTypeNode(
        typeArguments[1],
        context,
        parseState,
      ),
    };
  }

  return undefined;
}

function parseTypeNode(
  typeNode: TypeLikeNode,
  context: SourceContext,
  parseState: ParseState,
): JsonSchema {
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return parseTypeNode(typeNode.type, context, parseState);
  }

  if (typeNode.kind === ts.SyntaxKind.StringKeyword) {
    return { type: 'string' };
  }
  if (typeNode.kind === ts.SyntaxKind.NumberKeyword) {
    return { type: 'number' };
  }
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
    return { type: 'boolean' };
  }

  if (ts.isLiteralTypeNode(typeNode)) {
    if (ts.isStringLiteral(typeNode.literal)) {
      return { type: 'string' };
    }
    if (ts.isNumericLiteral(typeNode.literal)) {
      return { type: 'number' };
    }
    if (
      typeNode.literal.kind === ts.SyntaxKind.TrueKeyword
      || typeNode.literal.kind === ts.SyntaxKind.FalseKeyword
    ) {
      return { type: 'boolean' };
    }
  }

  if (ts.isUnionTypeNode(typeNode)) {
    const actualTypes = typeNode.types.filter(type =>
      !isNullLikeTypeNode(type) && !isUndefinedLikeTypeNode(type)
    );

    if (
      actualTypes.length === 2
      && actualTypes.every(type => isBooleanLiteralTypeNode(type))
    ) {
      return { type: 'boolean' };
    }

    if (actualTypes.length === 1) {
      return parseTypeNode(actualTypes[0]!, context, parseState);
    }

    if (
      actualTypes.length > 0
      && actualTypes.every(type => isStringLiteralTypeNode(type))
    ) {
      return {
        type: 'string',
        enum: actualTypes.map(type => (type.literal as ts.StringLiteral).text),
      };
    }

    const schemas = dedupeSchemas(
      actualTypes.map(type => parseTypeNode(type, context, parseState)),
    );
    if (schemas.length === 1) {
      return schemas[0]!;
    }

    return { oneOf: schemas };
  }

  if (ts.isArrayTypeNode(typeNode)) {
    return {
      type: 'array',
      items: parseTypeNode(typeNode.elementType, context, parseState),
    };
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    const properties: PropertyDefinition[] = [];
    const collected = collectTypeElementProperties(
      typeNode.members,
      context,
      parseState,
    );
    properties.push(...collected.properties);
    return buildObjectSchema(
      properties,
      context,
      parseState,
      false,
      undefined,
      collected.additionalProperties,
    ) as JsonSchema;
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    const recordSchema = parseRecordTypeReference(
      typeNode,
      context,
      parseState,
    );
    if (recordSchema) return recordSchema;

    const typeName = getTypeReferenceName(typeNode);
    if (typeName) {
      const declaration = context.localDeclarations.get(typeName);
      if (declaration) {
        return parseNamedDeclaration(
          typeName,
          declaration,
          context,
          parseState,
          false,
        ) as JsonSchema;
      }
    }
  }

  return { type: 'string' };
}

async function loadSourceContext(
  filePath: string,
  typeDocIndex: TypeDocIndex,
): Promise<SourceContext> {
  const text = await fs.readFile(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    inferScriptKind(filePath),
  );
  const jsDocTypedefs = parseJsDocTypedefs(text);

  return {
    filePath,
    jsDocTypedefs,
    localDeclarations: collectLocalDeclarations(sourceFile, jsDocTypedefs),
    sourceFile,
    typeDocIndex,
  };
}

async function getComponentEntryFiles(sourceDir: string): Promise<string[]> {
  const directoryEntries = await fs.readdir(sourceDir, { withFileTypes: true });
  const entryFiles: string[] = [];
  const indexCandidates = ['index.tsx', 'index.jsx', 'index.ts', 'index.js'];

  for (
    const entry of directoryEntries.sort((left, right) =>
      left.name.localeCompare(right.name)
    )
  ) {
    if (!entry.isDirectory()) continue;

    for (const candidate of indexCandidates) {
      const candidatePath = path.join(sourceDir, entry.name, candidate);
      try {
        const stats = await fs.stat(candidatePath);
        if (stats.isFile()) {
          entryFiles.push(candidatePath);
          break;
        }
      } catch {
        // Ignore missing entry candidates.
      }
    }
  }

  return entryFiles;
}

function buildLegacyCatalog(
  component: CatalogComponent,
): Record<string, JsonValue> {
  return {
    [component.name]: component.schema as unknown as JsonValue,
  };
}

function collectTypeElementProperties(
  members: readonly ts.TypeElement[],
  context: SourceContext,
  parseState: ParseState,
  typeDocRecord?: TypeDocRecord,
): CollectedTypeElements {
  const properties: PropertyDefinition[] = [];
  let additionalProperties: JsonSchema | boolean | undefined;

  for (const member of members) {
    if (ts.isIndexSignatureDeclaration(member)) {
      const parameter = member.parameters[0];
      if (
        parameter?.type
        && isStringIndexKeyType(parameter.type)
        && member.type
      ) {
        additionalProperties = parseTypeNode(member.type, context, parseState);
      }
      continue;
    }

    const name = getPropertyName(member);
    const typeNode = getPropertyTypeNode(member);
    if (!name || !typeNode) continue;

    const property: PropertyDefinition = {
      name,
      optional: isOptionalProperty(member, typeNode),
      typeNode,
    };
    const doc = mergePropertyDoc(
      typeDocRecord?.properties.get(name),
      getAstPropertyDoc(member),
    );
    if (doc) {
      property.doc = doc;
    }
    properties.push(property);
  }

  const collected: CollectedTypeElements = {
    properties,
  };
  if (additionalProperties !== undefined) {
    collected.additionalProperties = additionalProperties;
  }
  return collected;
}

function buildFullCatalog(
  components: readonly CatalogComponent[],
  options: ExtractCatalogOptions,
): Record<string, JsonValue> {
  const componentMap: Record<string, JsonValue> = {};
  for (const component of components) {
    componentMap[component.name] = component.schema as unknown as JsonValue;
  }

  const catalog: Record<string, JsonValue> = {};
  if (options.schema) catalog['$schema'] = options.schema;
  if (options.catalogId) catalog['catalogId'] = options.catalogId;
  if (options.title) catalog['title'] = options.title;
  if (options.description) catalog['description'] = options.description;
  catalog['components'] = componentMap;
  if (options.functions) {
    catalog['functions'] = options.functions as unknown as JsonValue;
  }
  if (options.theme) {
    catalog['theme'] = options.theme;
  }
  return catalog;
}

export async function extractCatalog(
  options: ExtractCatalogOptions,
): Promise<ExtractCatalogResult> {
  const format = options.format ?? 'legacy-shards';
  const sourceDir = path.resolve(options.sourceDir);
  const entryFiles = await getComponentEntryFiles(sourceDir);
  const typeDocIndex = await buildTypeDocIndex(
    entryFiles,
    options.tsconfigPath ? path.resolve(options.tsconfigPath) : undefined,
  );
  const componentFilter = options.components
    ? new Set(options.components)
    : undefined;
  const components: CatalogComponent[] = [];

  for (const entryFile of entryFiles) {
    const context = await loadSourceContext(entryFile, typeDocIndex);
    for (const component of getComponentDeclarations(context.sourceFile)) {
      if (componentFilter && !componentFilter.has(component.name)) {
        continue;
      }

      const typeNode = getParameterTypeNode(component.parameter);
      if (!typeNode) {
        throw new Error(
          `Component "${component.name}" in ${entryFile} does not declare props.`,
        );
      }

      let schema: ComponentSchema;
      if (ts.isTypeReferenceNode(typeNode)) {
        const typeName = getTypeReferenceName(typeNode);
        const declaration = typeName
          ? context.localDeclarations.get(typeName)
          : undefined;
        if (!typeName || !declaration) {
          throw new Error(
            `Component "${component.name}" in ${entryFile} uses unsupported props type "${
              typeNode.getText(context.sourceFile)
            }".`,
          );
        }
        schema = parseNamedDeclaration(
          typeName,
          declaration,
          context,
          { seen: new Set() },
          true,
        ) as ComponentSchema;
      } else if (ts.isTypeLiteralNode(typeNode)) {
        const properties: PropertyDefinition[] = [];
        for (const member of typeNode.members) {
          const propertyName = getPropertyName(member);
          const propertyType = getPropertyTypeNode(member);
          if (!propertyName || !propertyType) continue;
          properties.push({
            name: propertyName,
            optional: isOptionalProperty(member, propertyType),
            typeNode: propertyType,
          });
        }
        schema = buildObjectSchema(
          properties,
          context,
          { seen: new Set() },
          true,
        ) as ComponentSchema;
      } else {
        throw new Error(
          `Component "${component.name}" in ${entryFile} must use an interface, type alias, or object literal for props.`,
        );
      }

      components.push({
        entryFile,
        name: component.name,
        schema,
      });
    }
  }

  components.sort((left, right) => left.name.localeCompare(right.name));

  const result: ExtractCatalogResult = {
    components,
    format,
  };

  if (format === 'a2ui-catalog') {
    result.catalog = buildFullCatalog(components, options);
  }

  return result;
}

export function renderCatalogFiles(
  result: ExtractCatalogResult,
  options: RenderCatalogFilesOptions,
): CatalogFile[] {
  const outDir = path.resolve(options.outDir);

  if (result.format === 'a2ui-catalog') {
    return [{
      content: `${JSON.stringify(result.catalog, null, 2)}\n`,
      path: path.join(outDir, 'catalog.json'),
    }];
  }

  return result.components.map(component => ({
    content: `${JSON.stringify(buildLegacyCatalog(component), null, 2)}\n`,
    path: path.join(outDir, component.name, 'catalog.json'),
  }));
}

export async function writeCatalogFiles(
  result: ExtractCatalogResult,
  options: RenderCatalogFilesOptions,
): Promise<CatalogFile[]> {
  const files = renderCatalogFiles(result, options);

  await Promise.all(files.map(async (file) => {
    await fs.mkdir(path.dirname(file.path), { recursive: true });
    await fs.writeFile(file.path, file.content, 'utf8');
  }));

  return files;
}

export async function checkCatalogFiles(
  result: ExtractCatalogResult,
  options: RenderCatalogFilesOptions,
): Promise<CheckCatalogFilesResult> {
  const files = renderCatalogFiles(result, options);
  const missing: string[] = [];
  const mismatched: string[] = [];
  let actual: string | undefined;
  let expected: string | undefined;

  for (const file of files) {
    try {
      const fileContent = await fs.readFile(file.path, 'utf8');
      if (fileContent !== file.content) {
        mismatched.push(file.path);
        actual ??= fileContent;
        expected ??= file.content;
      }
    } catch {
      missing.push(file.path);
    }
  }

  const checkResult: CheckCatalogFilesResult = {
    mismatched,
    missing,
    ok: missing.length === 0 && mismatched.length === 0,
  };
  if (actual !== undefined) {
    checkResult.actual = actual;
  }
  if (expected !== undefined) {
    checkResult.expected = expected;
  }
  return checkResult;
}

export async function loadCatalogConfig(
  filePath: string,
): Promise<LoadCatalogConfigResult> {
  const resolvedPath = path.resolve(filePath);
  const extension = path.extname(resolvedPath);

  const config = extension === '.json'
    ? JSON.parse(await fs.readFile(resolvedPath, 'utf8')) as Record<
      string,
      JsonValue
    >
    : await import(pathToFileURL(resolvedPath).href)
      .then(module => (module.default ?? module) as Record<string, JsonValue>);

  return {
    config,
    path: resolvedPath,
  };
}

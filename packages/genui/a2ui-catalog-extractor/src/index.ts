// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { Application, OptionDefaults, ReflectionKind } from 'typedoc';
import type { ProjectReflection, TypeDocOptions } from 'typedoc';

export interface JsonSchema {
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  default?: unknown;
  deprecated?: boolean;
  description?: string;
  enum?: Array<boolean | number | string>;
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string;
}

export interface CatalogComponent {
  filePath: string;
  interfaceName: string;
  name: string;
  schema: JsonSchema;
}

export interface ExtractCatalogOptions {
  cwd?: string;
  sourceFiles: string[];
  tsconfig?: string;
}

export interface ExtractCatalogFromTypeDocOptions {
  cwd?: string;
}

export interface WriteComponentCatalogOptions extends ExtractCatalogOptions {
  outDir: string;
}

export interface A2UICatalog {
  catalogId: string;
  components?: Record<string, JsonSchema>;
  functions?: FunctionDefinition[];
  theme?: Record<string, JsonSchema>;
}

export interface FunctionDefinition {
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

interface ParsedDoc {
  a2uiCatalogName?: string;
  defaultValue?: unknown;
  deprecated?: boolean;
  description?: string;
}

export interface TypeDocProject {
  children?: TypeDocReflection[];
}

export interface TypeDocReflection {
  children?: TypeDocReflection[];
  comment?: TypeDocComment;
  flags?: {
    isOptional?: boolean;
  };
  inheritedFrom?: unknown;
  kind?: number;
  kindString?: string;
  name: string;
  sources?: TypeDocSource[];
  type?: TypeDocType;
}

export interface TypeDocSource {
  character?: number;
  fileName?: string;
  fullFileName?: string;
  line?: number;
}

export interface TypeDocComment {
  blockTags?: TypeDocCommentTag[];
  modifierTags?: Iterable<string> | Record<string, boolean>;
  summary?: TypeDocCommentDisplayPart[];
}

export interface TypeDocCommentTag {
  content?: TypeDocCommentDisplayPart[];
  tag: string;
}

export interface TypeDocCommentDisplayPart {
  code?: string;
  content?: TypeDocCommentDisplayPart[];
  kind?: string;
  tag?: string;
  target?: unknown;
  text?: string;
}

export interface TypeDocType {
  declaration?: TypeDocReflection;
  elementType?: TypeDocType;
  name?: string;
  qualifiedName?: string;
  target?: TypeDocType;
  type: string;
  typeArguments?: TypeDocType[];
  types?: TypeDocType[];
  value?: bigint | boolean | number | string | null;
}

const supportedSourceExtensions = new Set([
  '.cts',
  '.js',
  '.jsx',
  '.mts',
  '.ts',
  '.tsx',
]);

export function findCatalogSourceFiles(inputPath: string): string[] {
  const absoluteInputPath = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInputPath)) {
    return [];
  }

  const stat = fs.statSync(absoluteInputPath);
  if (stat.isFile()) {
    return isSupportedSourceFile(absoluteInputPath) ? [absoluteInputPath] : [];
  }

  const files: string[] = [];
  collectSourceFiles(absoluteInputPath, files);
  return files.sort((left, right) => left.localeCompare(right));
}

export async function extractCatalogComponents(
  options: ExtractCatalogOptions,
): Promise<CatalogComponent[]> {
  const project = await createTypeDocProject(options);
  return extractCatalogComponentsFromTypeDocProject(
    project,
    options.cwd ? { cwd: options.cwd } : {},
  );
}

export function extractCatalogComponentsFromTypeDocProject(
  project: ProjectReflection | TypeDocProject,
  options: ExtractCatalogFromTypeDocOptions = {},
): CatalogComponent[] {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const components: CatalogComponent[] = [];

  for (const reflection of walkReflections(project as TypeDocProject)) {
    if (!isInterfaceReflection(reflection)) {
      continue;
    }

    const parsedDoc = parseComment(reflection.comment);
    if (parsedDoc.a2uiCatalogName === undefined) {
      continue;
    }

    components.push({
      filePath: getReflectionFilePath(reflection, cwd),
      interfaceName: reflection.name,
      name: parsedDoc.a2uiCatalogName || inferCatalogName(reflection.name),
      schema: createComponentSchema(reflection, parsedDoc),
    });
  }

  return components;
}

export function extractCatalogComponentsFromTypeDocJson(
  project: TypeDocProject,
  options: ExtractCatalogFromTypeDocOptions = {},
): CatalogComponent[] {
  return extractCatalogComponentsFromTypeDocProject(project, options);
}

export async function writeComponentCatalogs(
  options: WriteComponentCatalogOptions,
): Promise<CatalogComponent[]> {
  const components = await extractCatalogComponents(options);
  writeCatalogComponents(components, options);
  return components;
}

export function writeCatalogComponents(
  components: CatalogComponent[],
  options: { cwd?: string; outDir: string },
): void {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const outDir = path.resolve(cwd, options.outDir);

  for (const component of components) {
    const componentOutDir = path.join(outDir, component.name);
    fs.mkdirSync(componentOutDir, { recursive: true });
    fs.writeFileSync(
      path.join(componentOutDir, 'catalog.json'),
      `${JSON.stringify({ [component.name]: component.schema }, null, 2)}\n`,
    );
  }
}

export function createA2UICatalog(options: {
  catalogId: string;
  components: CatalogComponent[] | Record<string, JsonSchema>;
  functions?: FunctionDefinition[];
  theme?: Record<string, JsonSchema>;
}): A2UICatalog {
  const catalogComponents = Array.isArray(options.components)
    ? Object.fromEntries(
      options.components.map(component => [component.name, component.schema]),
    )
    : options.components;

  return {
    catalogId: options.catalogId,
    components: catalogComponents,
    ...(options.functions ? { functions: options.functions } : {}),
    ...(options.theme ? { theme: options.theme } : {}),
  };
}

async function createTypeDocProject(
  options: ExtractCatalogOptions,
): Promise<ProjectReflection> {
  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const sourceFiles = options.sourceFiles.map(sourceFile =>
    path.resolve(cwd, sourceFile)
  );

  if (sourceFiles.length === 0) {
    throw new Error('No TypeDoc entry points were provided.');
  }

  const tsconfigPath = getTsconfigPath(cwd, options.tsconfig);
  const bootstrapOptions: TypeDocOptions = {
    blockTags: [...OptionDefaults.blockTags, '@a2uiCatalog'],
    entryPoints: sourceFiles,
    excludePrivate: false,
    excludeProtected: false,
    readme: 'none',
    skipErrorChecking: true,
    sort: ['source-order'],
    sortEntryPoints: false,
  };

  if (tsconfigPath) {
    bootstrapOptions.tsconfig = tsconfigPath;
  }

  const app = await Application.bootstrap(bootstrapOptions);
  const project = await app.convert();

  if (!project) {
    throw new Error('TypeDoc did not produce a project reflection.');
  }

  return project;
}

function collectSourceFiles(dir: string, files: string[]): void {
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const nextPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (
        dirent.name === 'node_modules' || dirent.name === 'dist'
        || dirent.name === '.turbo'
      ) {
        continue;
      }
      collectSourceFiles(nextPath, files);
    } else if (dirent.isFile() && isSupportedSourceFile(nextPath)) {
      files.push(nextPath);
    }
  }
}

function isSupportedSourceFile(filePath: string): boolean {
  if (filePath.endsWith('.d.ts')) {
    return false;
  }
  return supportedSourceExtensions.has(path.extname(filePath));
}

function* walkReflections(
  reflection: TypeDocReflection | TypeDocProject,
): Generator<TypeDocReflection> {
  for (const child of reflection.children ?? []) {
    yield child;
    yield* walkReflections(child);
  }
}

function isInterfaceReflection(reflection: TypeDocReflection): boolean {
  return reflection.kind === ReflectionKind.Interface
    || reflection.kindString === 'Interface';
}

function isPropertyReflection(reflection: TypeDocReflection): boolean {
  return reflection.kind === ReflectionKind.Property
    || reflection.kindString === 'Property';
}

function createComponentSchema(
  reflection: TypeDocReflection,
  parsedDoc: ParsedDoc,
): JsonSchema {
  if (reflection.children === undefined) {
    throw createReflectionError(
      reflection,
      `Missing interface member declarations for "${reflection.name}".`,
    );
  }

  const schema: JsonSchema = { properties: {}, required: [] };
  applyDocToSchema(schema, parsedDoc);

  for (const child of reflection.children) {
    if (child.inheritedFrom) {
      continue;
    }
    if (!isPropertyReflection(child)) {
      continue;
    }
    if (!child.type) {
      throw createReflectionError(child, `Missing type for "${child.name}".`);
    }

    const propertySchema = parseTypeDocType(child.type, child);
    applyDocToSchema(propertySchema, parseComment(child.comment));
    schema.properties![child.name] = propertySchema;

    if (!isOptionalProperty(child)) {
      schema.required!.push(child.name);
    }
  }

  return schema;
}

function parseTypeDocType(
  type: TypeDocType,
  owner: TypeDocReflection,
): JsonSchema {
  switch (type.type) {
    case 'intrinsic':
      return parseIntrinsicType(type.name ?? '', owner);
    case 'literal':
      return parseLiteralType(type.value, owner);
    case 'union':
      if (!type.types) {
        throw createReflectionError(
          owner,
          `Missing union members for "${owner.name}".`,
        );
      }
      return parseUnionType(type.types, owner);
    case 'array':
      if (!type.elementType) {
        throw createReflectionError(
          owner,
          `Missing array element type for "${owner.name}".`,
        );
      }
      return {
        type: 'array',
        items: parseTypeDocType(type.elementType, owner),
      };
    case 'reflection':
      if (!type.declaration) {
        throw createReflectionError(
          owner,
          `Missing reflection declaration for "${owner.name}".`,
        );
      }
      return parseObjectReflection(type.declaration, owner);
    case 'reference':
      return parseReferenceType(type, owner);
    case 'typeOperator':
      if (!type.target) {
        throw createReflectionError(
          owner,
          `Missing type operator target for "${owner.name}".`,
        );
      }
      return parseTypeDocType(type.target, owner);
    default:
      if (type.elementType) {
        return parseTypeDocType(type.elementType, owner);
      }
      throw createReflectionError(
        owner,
        `Unsupported TypeDoc type "${type.type}" for "${owner.name}".`,
      );
  }
}

function parseIntrinsicType(
  name: string,
  owner: TypeDocReflection,
): JsonSchema {
  switch (name) {
    case 'string':
    case 'number':
    case 'boolean':
      return { type: name };
    case 'any':
    case 'unknown':
    case 'undefined':
    case 'null':
    case 'never':
    case 'void':
      throw createReflectionError(
        owner,
        `Unsupported ambiguous intrinsic TypeDoc type "${name}" for "${owner.name}".`,
      );
    default:
      throw createReflectionError(
        owner,
        `Unsupported intrinsic TypeDoc type "${name}" for "${owner.name}".`,
      );
  }
}

function parseLiteralType(
  value: bigint | boolean | number | string | null | undefined,
  owner: TypeDocReflection,
): JsonSchema {
  switch (typeof value) {
    case 'string':
      return { type: 'string', enum: [value] };
    case 'number':
      return { type: 'number', enum: [value] };
    case 'bigint':
      throw createReflectionError(
        owner,
        `Unsupported bigint literal for "${owner.name}".`,
      );
    case 'boolean':
      return { type: 'boolean', enum: [value] };
    default:
      throw createReflectionError(
        owner,
        `Unsupported nullish literal for "${owner.name}".`,
      );
  }
}

function parseUnionType(
  types: TypeDocType[],
  owner: TypeDocReflection,
): JsonSchema {
  if (types.length === 0) {
    throw createReflectionError(
      owner,
      `Missing union members for "${owner.name}".`,
    );
  }

  if (types.some(type => isNullType(type))) {
    throw createReflectionError(
      owner,
      `Unsupported nullable union for "${owner.name}".`,
    );
  }

  const actualTypes = types.filter(type => !isUndefinedType(type));

  if (actualTypes.length === 0) {
    throw createReflectionError(
      owner,
      `Unsupported undefined-only union for "${owner.name}".`,
    );
  }
  if (actualTypes.length === 1) {
    return parseTypeDocType(actualTypes[0]!, owner);
  }

  const stringLiteralValues = actualTypes.map(type =>
    getStringLiteralValue(type)
  );
  if (stringLiteralValues.every(value => value !== undefined)) {
    return { type: 'string', enum: stringLiteralValues };
  }

  if (
    actualTypes.length === 2
    && actualTypes.every(type =>
      type.type === 'literal' && typeof type.value === 'boolean'
    )
  ) {
    return { type: 'boolean' };
  }

  const oneOf: JsonSchema[] = [];
  for (const childType of actualTypes) {
    const schema = parseTypeDocType(childType, owner);
    if (!oneOf.some(existing => schemasEqual(existing, schema))) {
      oneOf.push(schema);
    }
  }

  return oneOf.length === 1 ? oneOf[0]! : { oneOf };
}

function parseObjectReflection(
  declaration: TypeDocReflection,
  owner: TypeDocReflection,
): JsonSchema {
  if (declaration.children === undefined) {
    throw createReflectionError(
      owner,
      `Missing object declaration for "${owner.name}".`,
    );
  }

  const schema: JsonSchema = {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  };

  for (const child of declaration.children) {
    if (!isPropertyReflection(child)) {
      continue;
    }
    if (!child.type) {
      throw createReflectionError(child, `Missing type for "${child.name}".`);
    }

    const propertySchema = parseTypeDocType(child.type, child);
    applyDocToSchema(propertySchema, parseComment(child.comment));
    schema.properties![child.name] = propertySchema;

    if (!isOptionalProperty(child)) {
      schema.required!.push(child.name);
    }
  }

  return schema;
}

function parseReferenceType(
  type: TypeDocType,
  owner: TypeDocReflection,
): JsonSchema {
  const typeName = String(type.name ?? type.qualifiedName ?? '');
  const typeArguments = type.typeArguments ?? [];

  if (
    (typeName === 'Array' || typeName === 'ReadonlyArray')
    && typeArguments.length === 1
  ) {
    return {
      type: 'array',
      items: parseTypeDocType(typeArguments[0]!, owner),
    };
  }

  if (typeName === 'Record' && typeArguments.length === 2) {
    const keyType = typeArguments[0]!;
    if (!isStringKeyType(keyType)) {
      throw createReflectionError(
        owner,
        'A2UI catalog Record keys must be string-compatible.',
      );
    }
    return {
      type: 'object',
      additionalProperties: parseTypeDocType(typeArguments[1]!, owner),
    };
  }

  throw createReflectionError(
    owner,
    `Unsupported TypeDoc reference "${typeName}" for "${owner.name}". Use an inline type literal, array, union, or Record<string, T>.`,
  );
}

function parseComment(comment: TypeDocComment | undefined): ParsedDoc {
  if (!comment) {
    return {};
  }

  const parsedDoc: ParsedDoc = {};
  const summary = normalizeDescription(renderCommentParts(comment.summary));
  if (summary) {
    parsedDoc.description = summary;
  }

  if (hasModifierTag(comment, '@deprecated')) {
    parsedDoc.deprecated = true;
  }

  for (const block of comment.blockTags ?? []) {
    const content = normalizeDescription(renderCommentParts(block.content));
    switch (block.tag) {
      case '@a2uiCatalog':
        parsedDoc.a2uiCatalogName = content;
        break;
      case '@remarks':
        if (content) {
          parsedDoc.description = parsedDoc.description
            ? `${parsedDoc.description}\n\n${content}`
            : content;
        }
        break;
      case '@default':
      case '@defaultValue':
        if (content) {
          parsedDoc.defaultValue = parseDefaultValue(content);
        }
        break;
      case '@deprecated':
        parsedDoc.deprecated = true;
        break;
      default:
        break;
    }
  }

  return parsedDoc;
}

function applyDocToSchema(schema: JsonSchema, parsedDoc: ParsedDoc): void {
  if (parsedDoc.description) {
    schema.description = parsedDoc.description;
  }
  if (parsedDoc.defaultValue !== undefined) {
    schema.default = parsedDoc.defaultValue;
  }
  if (parsedDoc.deprecated) {
    schema.deprecated = true;
  }
}

function renderCommentParts(
  parts: TypeDocCommentDisplayPart[] | undefined,
): string {
  return (parts ?? []).map(part => renderCommentPart(part)).join('');
}

function renderCommentPart(part: TypeDocCommentDisplayPart): string {
  if (part.text !== undefined) {
    return part.text;
  }
  if (part.code !== undefined) {
    return `\`${part.code}\``;
  }
  if (part.content) {
    return renderCommentParts(part.content);
  }
  if (part.kind === 'softBreak') {
    return ' ';
  }
  return '';
}

function normalizeDescription(text: string): string {
  return text.replace(/[ \t\r\n]+/g, ' ').trim();
}

function parseDefaultValue(text: string): unknown {
  const trimmed = unwrapCodeSpan(text.trim());
  if (trimmed === 'undefined') {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function unwrapCodeSpan(text: string): string {
  if (text.startsWith('`') && text.endsWith('`') && text.length >= 2) {
    return text.slice(1, -1);
  }
  return text;
}

function hasModifierTag(comment: TypeDocComment, tag: string): boolean {
  const modifierTags = comment.modifierTags;
  if (!modifierTags) {
    return false;
  }
  if (typeof (modifierTags as Set<string>).has === 'function') {
    return (modifierTags as Set<string>).has(tag);
  }
  return Boolean((modifierTags as Record<string, boolean>)[tag]);
}

function isOptionalProperty(reflection: TypeDocReflection): boolean {
  return reflection.flags?.isOptional === true
    || (reflection.type ? typeIncludesUndefined(reflection.type) : false);
}

function typeIncludesUndefined(type: TypeDocType): boolean {
  if (type.type !== 'union') {
    return false;
  }
  return (type.types ?? []).some(childType => isUndefinedType(childType));
}

function isUndefinedType(type: TypeDocType): boolean {
  return type.type === 'intrinsic' && type.name === 'undefined';
}

function isNullType(type: TypeDocType): boolean {
  return (type.type === 'intrinsic' && type.name === 'null')
    || (type.type === 'literal' && type.value === null);
}

function getStringLiteralValue(type: TypeDocType): string | undefined {
  if (type.type === 'literal' && typeof type.value === 'string') {
    return type.value;
  }
  return undefined;
}

function isStringKeyType(type: TypeDocType): boolean {
  if (type.type === 'intrinsic' && type.name === 'string') {
    return true;
  }
  if (type.type === 'union') {
    return (type.types ?? []).every(childType =>
      childType.type === 'literal' && typeof childType.value === 'string'
    );
  }
  return false;
}

function getReflectionFilePath(
  reflection: TypeDocReflection,
  cwd: string,
): string {
  const source = reflection.sources?.[0];
  if (!source) {
    return '';
  }
  if (source.fullFileName) {
    return path.resolve(source.fullFileName);
  }
  if (source.fileName) {
    return path.resolve(cwd, source.fileName);
  }
  return '';
}

function createReflectionError(
  reflection: TypeDocReflection,
  message: string,
): Error {
  const source = reflection.sources?.[0];
  if (!source) {
    return new Error(message);
  }

  const fileName = source.fullFileName ?? source.fileName ?? '';
  const line = source.line ? `:${source.line}` : '';
  const character = source.character ? `:${source.character}` : '';
  return new Error(`${fileName}${line}${character} ${message}`.trim());
}

function inferCatalogName(interfaceName: string): string {
  return interfaceName.replace(/(?:Component)?Props$/, '');
}

function schemasEqual(left: JsonSchema, right: JsonSchema): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getTsconfigPath(
  cwd: string,
  tsconfig: string | undefined,
): string | undefined {
  if (tsconfig) {
    return path.resolve(cwd, tsconfig);
  }

  const defaultTsconfig = path.join(cwd, 'tsconfig.json');
  return fs.existsSync(defaultTsconfig) ? defaultTsconfig : undefined;
}

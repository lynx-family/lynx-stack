// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

export interface CodegenOptions {
  root?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  overwrite?: boolean;
}

export type NativeModuleTypeName =
  | 'void'
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'date'
  | 'symbol'
  | 'array'
  | 'arraybuffer'
  | 'typedarray'
  | 'int8array'
  | 'uint8array'
  | 'int16array'
  | 'uint16array'
  | 'int32array'
  | 'uint32array'
  | 'float32array'
  | 'float64array'
  | 'bigint64array'
  | 'biguint64array'
  | 'dataview'
  | 'object'
  | 'function'
  | 'promise'
  | 'buffer'
  | 'value';

export interface NativeModuleType {
  name: NativeModuleTypeName;
  nullable: boolean;
}

interface NativeModuleTypeWithSource extends NativeModuleType {
  source?: string;
}

interface NativeModuleSourceLocation {
  file: string;
  line: number;
}

export interface NativeModuleParam {
  name: string;
  type: NativeModuleType;
  source?: NativeModuleSourceLocation;
}

export interface NativeModuleMethod {
  name: string;
  params: NativeModuleParam[];
  returnType: NativeModuleType;
  source?: NativeModuleSourceLocation;
}

export interface NativeModuleSpec {
  name: string;
  methods: NativeModuleMethod[];
  source?: NativeModuleSourceLocation;
}

interface LynxLibJson {
  platforms: {
    android?: {
      packageName: string;
      sourceDir: string;
    };
    ios?: {
      sourceDir: string;
    };
    harmony?: {
      sourceDir: string;
    };
    lynxtron?: Record<string, unknown>;
  };
}

const MODULE_HEADER_PATTERN =
  /\/\*\*[\s\S]*?@lynxmodule[\s\S]*?\*\/\s*export\s+declare\s+class\s+([A-Za-z_$][\w$]*)\s*\{/g;
const IDENTIFIER_PATTERN = /^[A-Z_$][\w$]*$/i;
const JAVA_PACKAGE_NAME_PATTERN = /^[A-Z_]\w*(?:\.[A-Z_]\w*)*$/i;
const PLATFORM_NATIVE_MODULE_TYPES_FILE = 'platform-native-module.d.ts';
const NAPI_NATIVE_MODULE_TYPES_FILE = 'napi-native-module.d.ts';
const NAPI_CPP_WRAPPER_TYPES: Partial<Record<NativeModuleTypeName, string>> = {
  array: 'Napi::Array',
  arraybuffer: 'Napi::ArrayBuffer',
  bigint: 'Napi::BigInt',
  bigint64array: 'Napi::BigInt64Array',
  biguint64array: 'Napi::BigUint64Array',
  boolean: 'Napi::Boolean',
  buffer: 'Napi::Buffer<uint8_t>',
  dataview: 'Napi::DataView',
  date: 'Napi::Date',
  float32array: 'Napi::Float32Array',
  float64array: 'Napi::Float64Array',
  function: 'Napi::Function',
  int16array: 'Napi::Int16Array',
  int32array: 'Napi::Int32Array',
  int8array: 'Napi::Int8Array',
  number: 'Napi::Number',
  object: 'Napi::Object',
  promise: 'Napi::Promise',
  string: 'Napi::String',
  symbol: 'Napi::Symbol',
  typedarray: 'Napi::TypedArray',
  uint16array: 'Napi::Uint16Array',
  uint32array: 'Napi::Uint32Array',
  uint8array: 'Napi::Uint8Array',
  value: 'Napi::Value',
};

/**
 * Parses native module declarations marked with `@lynxmodule` from a TypeScript declaration source.
 */
export function parseNativeModules(
  source: string,
  filename = '<inline>',
): NativeModuleSpec[] {
  const sourceFilename = normalizeSourcePath(filename);
  const modules: NativeModuleSpec[] = [];
  const seen = new Set<string>();

  for (
    const {
      body,
      bodyStartLine,
      line,
      name: moduleName,
    } of findNativeModuleDeclarations(source, sourceFilename)
  ) {
    if (seen.has(moduleName)) {
      throw new Error(
        `Duplicate native module "${moduleName}" in ${sourceFilename}`,
      );
    }
    seen.add(moduleName);

    modules.push({
      name: moduleName,
      methods: parseMethods(body, sourceFilename, moduleName, bodyStartLine),
      source: { file: sourceFilename, line },
    });
  }

  return modules;
}

function normalizeSourcePath(filename: string): string {
  return filename.split(path.win32.sep).join(path.posix.sep);
}

/**
 * Finds native module declarations and captures class bodies while ignoring braces in comments and strings.
 */
function findNativeModuleDeclarations(
  source: string,
  filename: string,
): Array<{ name: string; body: string; line: number; bodyStartLine: number }> {
  const declarations: Array<{
    name: string;
    body: string;
    line: number;
    bodyStartLine: number;
  }> = [];
  const pattern = new RegExp(MODULE_HEADER_PATTERN);
  let match = pattern.exec(source);

  while (match !== null) {
    const moduleName = match[1];
    const matchedHeader = match[0];

    if (moduleName === undefined) {
      match = pattern.exec(source);
      continue;
    }

    const openBraceIndex = match.index + matchedHeader.length - 1;
    const closeBraceIndex = findMatchingBrace(source, openBraceIndex);

    if (closeBraceIndex === -1) {
      throw new Error(
        `Invalid native module declaration in ${filename}: ${moduleName} is missing a closing brace`,
      );
    }

    declarations.push({
      name: moduleName,
      body: source.slice(openBraceIndex + 1, closeBraceIndex),
      line: lineNumberAt(source, match.index),
      bodyStartLine: lineNumberAt(source, openBraceIndex + 1),
    });

    pattern.lastIndex = closeBraceIndex + 1;
    match = pattern.exec(source);
  }

  return declarations;
}

function lineNumberAt(source: string, index: number): number {
  let line = 1;

  for (let current = 0; current < index; current += 1) {
    if (source.charAt(current) === '\n') {
      line += 1;
    }
  }

  return line;
}

/**
 * Returns the matching `}` for a class body opener, ignoring comments and strings.
 */
function findMatchingBrace(source: string, openBraceIndex: number): number {
  let braceDepth = 1;
  let inBlockComment = false;
  let inLineComment = false;
  let quote: string | undefined;
  let escaped = false;

  for (let index = openBraceIndex + 1; index < source.length; index += 1) {
    const character = source.charAt(index);
    const next = source.charAt(index + 1);

    if (inBlockComment) {
      if (character === '*' && next === '/') {
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inLineComment) {
      if (character === '\n' || character === '\r') {
        inLineComment = false;
      }
      continue;
    }

    if (quote !== undefined) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (character === '/' && next === '/') {
      index += 1;
      inLineComment = true;
      continue;
    }

    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '{') {
      braceDepth += 1;
      continue;
    }

    if (character === '}') {
      braceDepth -= 1;

      if (braceDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}

/**
 * Builds the generated JS facade, Android spec, and iOS spec file contents for a library package.
 */
export function generate(options: CodegenOptions = {}): GeneratedFile[] {
  const root = path.resolve(options.root ?? process.cwd());
  const manifest = readManifest(root);
  const { napiModules, platformModules } = readNativeModuleSpecs(root);
  const seenModules = new Set<string>();
  const files: GeneratedFile[] = [];

  for (const module of platformModules) {
    if (seenModules.has(module.name)) {
      throw new Error(`Duplicate native module "${module.name}" across types`);
    }
    seenModules.add(module.name);

    files.push({
      path: path.posix.join('generated', `${module.name}.ts`),
      content: generateJsFacade(module),
    });
    if (manifest.platforms.android !== undefined) {
      files.push({
        path: path.posix.join(
          manifest.platforms.android.sourceDir,
          'src',
          'main',
          'java',
          ...manifest.platforms.android.packageName.split('.'),
          'generated',
          `${module.name}Spec.java`,
        ),
        content: generateAndroidSpec(
          module,
          manifest.platforms.android.packageName,
        ),
      });
    }

    if (manifest.platforms.ios !== undefined) {
      files.push({
        path: path.posix.join(
          manifest.platforms.ios.sourceDir,
          'src',
          'generated',
          `${module.name}Spec.h`,
        ),
        content: generateIosHeader(module),
      });
      files.push({
        path: path.posix.join(
          manifest.platforms.ios.sourceDir,
          'src',
          'generated',
          `${module.name}Spec.m`,
        ),
        content: generateIosImplementation(module),
      });
    }

    if (manifest.platforms.harmony !== undefined) {
      files.push({
        path: path.posix.join(
          manifest.platforms.harmony.sourceDir,
          'src',
          'main',
          'ets',
          'generated',
          `${module.name}Spec.ets`,
        ),
        content: generateHarmonySpec(module),
      });
    }
  }

  if (napiModules.length > 0) {
    files.push({
      path: path.posix.join('shared', 'nativeModule', 'CMakeLists.txt'),
      content: generateNapiNativeModuleCMake(),
      overwrite: false,
    });
  }

  for (const module of napiModules) {
    if (seenModules.has(module.name)) {
      throw new Error(`Duplicate native module "${module.name}" across types`);
    }
    seenModules.add(module.name);

    files.push({
      path: path.posix.join('generated', `${module.name}.ts`),
      content: generateJsFacade(module),
    });
    files.push(...generateNapiNativeModuleFiles(module));
  }

  return files;
}

/**
 * Writes generated files to disk and returns the generated file descriptors.
 */
export function runCodegen(options: CodegenOptions = {}): GeneratedFile[] {
  const root = path.resolve(options.root ?? process.cwd());
  const files = generate({ root });
  const targets = files.map((file) => ({
    file,
    target: resolveInside(root, file.path, 'package root'),
  }));

  for (const { target } of targets) {
    assertNoSymlinkTraversal(root, target);
  }

  for (const { file, target } of targets) {
    if (file.overwrite === false && fs.existsSync(target)) {
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }

  return files;
}

/**
 * Parses method signatures from a native module declaration body.
 */
function parseMethods(
  body: string,
  filename: string,
  moduleName: string,
  bodyStartLine: number,
): NativeModuleMethod[] {
  const methods: NativeModuleMethod[] = [];
  const seen = new Set<string>();

  for (
    const declaration of splitMethodDeclarations(
      body,
      filename,
      moduleName,
      bodyStartLine,
    )
  ) {
    const trimmed = declaration.source;
    const openParen = trimmed.indexOf('(');
    const closeParen = trimmed.lastIndexOf(')');
    const returnColon = closeParen === -1
      ? -1
      : trimmed.indexOf(':', closeParen);

    if (
      openParen <= 0 || closeParen <= openParen || returnColon <= closeParen
    ) {
      throw new Error(
        `Invalid method declaration in ${filename}: ${moduleName}.${trimmed}`,
      );
    }

    const methodName = trimmed.slice(0, openParen).trim();
    const paramsSource = trimmed.slice(openParen + 1, closeParen);
    const returnSource = trimmed.slice(returnColon + 1).trim();

    if (!IDENTIFIER_PATTERN.test(methodName)) {
      throw new Error(
        `Invalid method name "${methodName}" in ${filename}: ${moduleName}`,
      );
    }

    if (seen.has(methodName)) {
      throw new Error(
        `Duplicate method "${moduleName}.${methodName}" in ${filename}`,
      );
    }
    seen.add(methodName);

    methods.push({
      name: methodName,
      params: parseParams(
        paramsSource,
        filename,
        moduleName,
        methodName,
        declaration,
      ),
      returnType: parseType(
        returnSource.trim(),
        filename,
        `${moduleName}.${methodName} return`,
      ),
      source: { file: filename, line: declaration.line },
    });
  }

  return methods;
}

interface MethodDeclaration {
  source: string;
  text: string;
  line: number;
}

/**
 * Removes TypeScript comments while preserving line boundaries and string content.
 */
function stripTypeScriptComments(source: string): string {
  let result = '';
  let inBlockComment = false;
  let inLineComment = false;
  let quote: string | undefined;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source.charAt(index);
    const next = source.charAt(index + 1);

    if (inBlockComment) {
      if (character === '\n' || character === '\r') {
        result += character;
      } else {
        result += ' ';
      }

      if (character === '*' && next === '/') {
        result += ' ';
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (inLineComment) {
      if (character === '\n' || character === '\r') {
        result += character;
        inLineComment = false;
      } else {
        result += ' ';
      }
      continue;
    }

    if (quote !== undefined) {
      result += character;

      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === '\\') {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = undefined;
      }
      continue;
    }

    if (character === '/' && next === '*') {
      result += '  ';
      index += 1;
      inBlockComment = true;
      continue;
    }

    if (character === '/' && next === '/') {
      result += '  ';
      index += 1;
      inLineComment = true;
      continue;
    }

    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
    }

    result += character;
  }

  return result;
}

/**
 * Splits a module body into method declarations while ignoring comments and accepting semicolon/newline separators.
 */
function splitMethodDeclarations(
  body: string,
  filename: string,
  moduleName: string,
  bodyStartLine: number,
): MethodDeclaration[] {
  const declarations: MethodDeclaration[] = [];
  const source = stripTypeScriptComments(body);
  let buffer = '';
  let rawBuffer = '';
  let bufferLine = bodyStartLine;

  const lines = source.split(/\r?\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? '';
    const parts = line.split(';');

    for (let index = 0; index < parts.length; index += 1) {
      const rawPart = parts[index] ?? '';
      const part = rawPart.trim();

      if (part.length > 0) {
        if (buffer.length === 0) {
          bufferLine = bodyStartLine + lineIndex;
        }
        buffer = `${buffer} ${part}`.trim();
        rawBuffer = rawBuffer.length === 0
          ? rawPart
          : `${rawBuffer}\n${rawPart}`;
      }

      if (
        buffer.length > 0
        && (index < parts.length - 1 || isCompleteMethodDeclaration(buffer))
      ) {
        declarations.push({
          source: buffer,
          text: rawBuffer,
          line: bufferLine,
        });
        buffer = '';
        rawBuffer = '';
      }
    }
  }

  if (buffer.length > 0) {
    throw new Error(
      `Invalid method declaration in ${filename}: ${moduleName}.${buffer}`,
    );
  }

  return declarations;
}

/**
 * Checks whether a buffered method declaration has balanced parentheses and a return type.
 */
function isCompleteMethodDeclaration(source: string): boolean {
  if (source.length === 0) {
    return false;
  }

  let parenDepth = 0;

  for (const character of source) {
    if (character === '(') {
      parenDepth += 1;
      continue;
    }

    if (character === ')') {
      parenDepth -= 1;

      if (parenDepth < 0) {
        return false;
      }
    }
  }

  if (parenDepth !== 0) {
    return false;
  }

  const openParen = source.indexOf('(');
  const closeParen = source.lastIndexOf(')');
  const returnColon = closeParen === -1
    ? -1
    : source.indexOf(':', closeParen);

  return openParen > 0 && closeParen > openParen && returnColon > closeParen;
}

/**
 * Parses and validates native module method parameters.
 */
function parseParams(
  source: string,
  filename: string,
  moduleName: string,
  methodName: string,
  declaration: MethodDeclaration,
): NativeModuleParam[] {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const params = splitTypeScriptParameterList(trimmed).filter((paramSource) =>
    paramSource.trim().length > 0
  );

  return params.map((paramSource): NativeModuleParam => {
    const normalizedParam = paramSource.trim();
    const colon = normalizedParam.indexOf(':');

    if (colon <= 0 || colon === normalizedParam.length - 1) {
      throw new Error(
        `Invalid parameter declaration in ${filename}: ${moduleName}.${methodName}(${paramSource})`,
      );
    }

    const rawName = normalizedParam.slice(0, colon).trim();
    const optional = rawName.endsWith('?');
    const name = optional ? rawName.slice(0, -1).trim() : rawName;
    const typeSource = normalizedParam.slice(colon + 1).trim();

    if (!IDENTIFIER_PATTERN.test(name)) {
      throw new Error(
        `Invalid parameter name "${rawName}" in ${filename}: ${moduleName}.${methodName}`,
      );
    }

    if (optional) {
      throw new Error(
        `Optional parameter "${moduleName}.${methodName}.${name}" is not supported by Lynx library codegen v1`,
      );
    }

    const type = parseType(
      typeSource,
      filename,
      `${moduleName}.${methodName}.${name}`,
    );

    if (type.name === 'void') {
      throw new Error(
        `Unsupported parameter type "void" for ${moduleName}.${methodName}.${name} in ${filename}. Lynx library codegen v1 only supports void as a return type.`,
      );
    }

    return {
      name,
      type,
      source: {
        file: filename,
        line: findParameterLine(declaration, name),
      },
    };
  });
}

function findParameterLine(
  declaration: MethodDeclaration,
  paramName: string,
): number {
  const pattern = new RegExp(
    `(?:^\\s*|[(,]\\s*)${escapeRegExp(paramName)}\\s*:`,
  );
  const lines = declaration.text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index] ?? '')) {
      return declaration.line + index;
    }
  }

  return declaration.line;
}

function escapeRegExp(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits a TypeScript parameter list without splitting inside generic or nested type syntax.
 */
function splitTypeScriptParameterList(source: string): string[] {
  const params: string[] = [];
  let buffer = '';
  let angleDepth = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let quote: string | undefined;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? '';
    const previous = source[index - 1];

    if (quote !== undefined) {
      buffer += character;

      if (character === quote && previous !== '\\') {
        quote = undefined;
      }
      continue;
    }

    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      buffer += character;
      continue;
    }

    switch (character) {
      case '<':
        angleDepth += 1;
        break;
      case '>':
        angleDepth = Math.max(0, angleDepth - 1);
        break;
      case '(':
        parenDepth += 1;
        break;
      case ')':
        parenDepth = Math.max(0, parenDepth - 1);
        break;
      case '[':
        bracketDepth += 1;
        break;
      case ']':
        bracketDepth = Math.max(0, bracketDepth - 1);
        break;
      case '{':
        braceDepth += 1;
        break;
      case '}':
        braceDepth = Math.max(0, braceDepth - 1);
        break;
      case ',':
        if (
          angleDepth === 0
          && parenDepth === 0
          && bracketDepth === 0
          && braceDepth === 0
        ) {
          params.push(buffer);
          buffer = '';
          continue;
        }
        break;
    }

    buffer += character;
  }

  params.push(buffer);
  return params;
}

/**
 * Resolves a generated path and rejects paths that escape the package root.
 */
function resolveInside(root: string, filePath: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, filePath);
  const relativePath = path.relative(resolvedRoot, target);

  if (
    relativePath === '..' || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath)
  ) {
    throw new Error(`Generated path escapes ${label}: ${filePath}`);
  }

  return target;
}

/**
 * Rejects generated targets that traverse an existing symlink inside the package root.
 */
function assertNoSymlinkTraversal(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const relativePath = path.relative(resolvedRoot, target);

  if (relativePath.length === 0) {
    return;
  }

  let current = resolvedRoot;

  for (const segment of relativePath.split(path.sep)) {
    current = path.join(current, segment);

    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(
        `Generated path escapes package root via symlink: ${
          path.relative(resolvedRoot, current)
        }`,
      );
    }
  }
}

/**
 * Parses a supported Lynx library type, including nullable unions.
 */
function parseType(
  source: string,
  filename: string,
  context: string,
): NativeModuleType {
  const parts = source.split('|').map((part) => part.trim()).filter(Boolean);
  const nullable = parts.includes('null');
  const nonNullParts = parts.filter((part) => part !== 'null');

  if (nonNullParts.length !== 1) {
    throw unsupportedType(source, filename, context);
  }

  const nonNullTypeSource = nonNullParts[0];
  if (nonNullTypeSource === undefined) {
    throw unsupportedType(source, filename, context);
  }

  const name = normalizeNativeModuleType(nonNullTypeSource);

  if (name === undefined) {
    throw unsupportedType(source, filename, context);
  }

  if (nullable && name === 'void') {
    throw unsupportedType(source, filename, context);
  }

  return withTypeSource({ name, nullable }, nonNullTypeSource);
}

/**
 * Stores the original non-null TypeScript type syntax for regenerated comments.
 */
function withTypeSource(
  type: NativeModuleType,
  source: string,
): NativeModuleType {
  Object.defineProperty(type, 'source', {
    configurable: true,
    enumerable: false,
    value: source.trim(),
  });
  return type;
}

/**
 * Normalizes TypeScript native module type syntax into the supported codegen type set.
 */
function normalizeNativeModuleType(
  source: string,
): NativeModuleTypeName | undefined {
  const trimmed = source.trim();
  const lower = trimmed.toLowerCase();

  switch (trimmed) {
    case 'void':
    case 'string':
    case 'number':
    case 'boolean':
      return trimmed;
  }

  const directTypes: Record<string, NativeModuleTypeName> = {
    any: 'value',
    array: 'array',
    arraybuffer: 'arraybuffer',
    bigint: 'bigint',
    bigint64array: 'bigint64array',
    biguint64array: 'biguint64array',
    boolean: 'boolean',
    buffer: 'buffer',
    dataview: 'dataview',
    date: 'date',
    float32array: 'float32array',
    float64array: 'float64array',
    function: 'function',
    int16array: 'int16array',
    int32array: 'int32array',
    int8array: 'int8array',
    object: 'object',
    promise: 'promise',
    symbol: 'symbol',
    typedarray: 'typedarray',
    uint16array: 'uint16array',
    uint32array: 'uint32array',
    uint8array: 'uint8array',
    unknown: 'value',
    value: 'value',
  };
  const directType = directTypes[lower];

  if (directType !== undefined) {
    return directType;
  }

  if (trimmed.endsWith('[]') || /^(?:ReadonlyArray|Array)<.+>$/.test(trimmed)) {
    return 'array';
  }

  if (/^(?:Record|Map|WeakMap|Set|WeakSet)<.+>$/.test(trimmed)) {
    return 'object';
  }

  if (/^Promise<.+>$/.test(trimmed)) {
    return 'promise';
  }

  if (
    /^\(.*\)\s*=>\s*(?:\S.*|[\t\v\f \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff])$/
      .test(trimmed)
  ) {
    return 'function';
  }

  return undefined;
}

/**
 * Creates a consistent unsupported-type error for parser and generator validation.
 */
function unsupportedType(
  source: string,
  filename: string,
  context: string,
): Error {
  return new Error(
    `Unsupported type "${source}" for ${context} in ${filename}. Lynx library codegen v1 supports N-API wrapped value types and unions with null.`,
  );
}

/**
 * Reads platform and NAPI native module specs declared under the package `types` directory.
 */
function readNativeModuleSpecs(root: string): {
  napiModules: NativeModuleSpec[];
  platformModules: NativeModuleSpec[];
} {
  const typesDir = path.join(root, 'types');

  if (!fs.existsSync(typesDir)) {
    return { napiModules: [], platformModules: [] };
  }

  const platformTypesFile = path.join(
    typesDir,
    PLATFORM_NATIVE_MODULE_TYPES_FILE,
  );
  const napiTypesFile = path.join(typesDir, NAPI_NATIVE_MODULE_TYPES_FILE);
  const napiModules = fs.existsSync(napiTypesFile)
    ? readNativeModuleSpecFile(napiTypesFile, root)
    : [];
  const platformModules = fs.existsSync(platformTypesFile)
    ? readNativeModuleSpecFile(platformTypesFile, root)
    : readLegacyNativeModuleSpecs(typesDir, root, napiTypesFile);

  return { napiModules, platformModules };
}

/**
 * Reads pre-split native module specs while excluding the NAPI split file.
 */
function readLegacyNativeModuleSpecs(
  typesDir: string,
  root: string,
  napiTypesFile: string,
): NativeModuleSpec[] {
  const modules: NativeModuleSpec[] = [];

  for (const file of walkFiles(typesDir)) {
    if (
      !file.endsWith('.d.ts')
      || path.resolve(file) === path.resolve(napiTypesFile)
    ) {
      continue;
    }

    modules.push(...readNativeModuleSpecFile(file, root));
  }

  return modules;
}

/**
 * Reads one native module declaration file.
 */
function readNativeModuleSpecFile(
  file: string,
  root: string,
): NativeModuleSpec[] {
  const source = fs.readFileSync(file, 'utf8');
  return parseNativeModules(source, path.relative(root, file));
}

/**
 * Recursively lists files in deterministic order.
 */
function walkFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

/**
 * Reads and normalizes the Lynx library manifest.
 */
function readManifest(root: string): LynxLibJson {
  const manifestPath = path.join(root, 'lynx.lib.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing lynx.lib.json in ${root}. Lynx library codegen must run from a library package root.`,
    );
  }

  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  const platforms = readObject(json, 'platforms', manifestPath);
  const android = readOptionalObject(platforms, 'android', manifestPath);
  const ios = readOptionalObject(platforms, 'ios', manifestPath);
  const harmony = readOptionalObject(platforms, 'harmony', manifestPath);
  const lynxtron = readOptionalObject(platforms, 'lynxtron', manifestPath);

  if (
    android === undefined && ios === undefined && harmony === undefined
    && lynxtron === undefined
  ) {
    throw new Error(
      `${manifestPath} must define at least one Native platform under "platforms"`,
    );
  }

  const normalizedPlatforms: LynxLibJson['platforms'] = {};

  if (android !== undefined) {
    const packageName = readRequiredString(
      android,
      'packageName',
      manifestPath,
      'platforms.android.packageName',
    );

    if (!JAVA_PACKAGE_NAME_PATTERN.test(packageName)) {
      throw new Error(
        `${manifestPath} must define "platforms.android.packageName" as a valid Java package identifier (got "${packageName}")`,
      );
    }

    normalizedPlatforms.android = {
      packageName,
      sourceDir: readOptionalString(
        android,
        'sourceDir',
        manifestPath,
        'platforms.android.sourceDir',
      ) ?? 'android',
    };
  }

  if (ios !== undefined) {
    normalizedPlatforms.ios = {
      sourceDir: readOptionalString(
        ios,
        'sourceDir',
        manifestPath,
        'platforms.ios.sourceDir',
      ) ?? 'ios',
    };
  }

  if (harmony !== undefined) {
    normalizedPlatforms.harmony = {
      sourceDir: readOptionalString(
        harmony,
        'sourceDir',
        manifestPath,
        'platforms.harmony.sourceDir',
      ) ?? 'harmony',
    };
  }

  if (lynxtron !== undefined) {
    normalizedPlatforms.lynxtron = lynxtron;
  }

  return {
    platforms: normalizedPlatforms,
  };
}

/**
 * Reads a required object property from `lynx.lib.json`.
 */
function readObject(
  value: unknown,
  key: string,
  manifestPath: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${manifestPath} must be a JSON object`);
  }

  const child = value[key];

  if (!isRecord(child)) {
    throw new Error(`${manifestPath} must define object "${key}"`);
  }

  return child;
}

/**
 * Reads an optional object property from `lynx.lib.json`.
 */
function readOptionalObject(
  value: Record<string, unknown>,
  key: string,
  manifestPath: string,
): Record<string, unknown> | undefined {
  const child = value[key];

  if (child === undefined) {
    return undefined;
  }

  if (!isRecord(child)) {
    throw new Error(`${manifestPath} must define object "${key}"`);
  }

  return child;
}

/**
 * Reads a required non-empty string from `lynx.lib.json`.
 */
function readRequiredString(
  value: Record<string, unknown>,
  key: string,
  manifestPath: string,
  displayPath: string,
): string {
  const child = value[key];

  if (typeof child !== 'string' || child.trim().length === 0) {
    throw new Error(`${manifestPath} must define string "${displayPath}"`);
  }

  return child;
}

/**
 * Reads an optional non-empty string from `lynx.lib.json`.
 */
function readOptionalString(
  value: Record<string, unknown>,
  key: string,
  manifestPath: string,
  displayPath: string,
): string | undefined {
  const child = value[key];

  if (child === undefined) {
    return undefined;
  }

  if (typeof child === 'string' && child.trim().length > 0) {
    return child;
  }

  throw new Error(
    `${manifestPath} must define non-empty string "${displayPath}"`,
  );
}

/**
 * Narrows unknown JSON values to plain object records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Generates the TypeScript facade for one native module.
 */
function generateJsFacade(module: NativeModuleSpec): string {
  const methods = module.methods.map((method) =>
    `  ${method.name}(${
      method.params.map((param) => `${param.name}: ${toTsType(param.type)}`)
        .join(
          ', ',
        )
    }): ${toTsType(method.returnType)};`
  ).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.

declare const NativeModules: {
  ${module.name}: {
${methods}
  };
};

export const ${module.name}: typeof NativeModules.${module.name} = NativeModules.${module.name};
export default ${module.name};
`;
}

/**
 * Generates the shared C++ N-API files for one NAPI native module.
 */
function generateNapiNativeModuleFiles(
  module: NativeModuleSpec,
): GeneratedFile[] {
  const baseDir = path.posix.join('shared', 'nativeModule');

  return [
    {
      path: path.posix.join(baseDir, `${module.name}.cc`),
      content: generateNapiNativeModuleImplementation(module),
      overwrite: false,
    },
  ];
}

/**
 * Generates the shared NAPI native module CMake target.
 */
function generateNapiNativeModuleCMake(): string {
  return `file(GLOB_RECURSE LYNX_LIBRARY_NAPI_NATIVE_MODULE_SOURCES CONFIGURE_DEPENDS
  "\${CMAKE_CURRENT_SOURCE_DIR}/*.cc"
)

if(NOT DEFINED LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET)
  set(LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET "\${PROJECT_NAME}NapiNativeModules")
endif()

add_library(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} OBJECT
  \${LYNX_LIBRARY_NAPI_NATIVE_MODULE_SOURCES}
)

target_include_directories(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
  "\${CMAKE_CURRENT_SOURCE_DIR}/../.."
  "\${LYNX_EXTENSION_HEADERS_DIR}/include"
)

if(LYNX_LIBRARY_NODE_API_WEAK_SUFFIX)
  target_include_directories(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    "\${LYNX_WEAK_NODE_API_HEADERS_DIR}"
  )
  target_compile_definitions(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    USE_WEAK_SUFFIX_NAPI=1
  )
endif()

if(NOT CMAKE_SOURCE_DIR STREQUAL CMAKE_CURRENT_SOURCE_DIR)
  set(
    LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET
    "\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET}"
    PARENT_SCOPE
  )
endif()
`;
}

/**
 * Generates the user-owned C++ N-API stub for one NAPI native module.
 */
function generateNapiNativeModuleImplementation(
  module: NativeModuleSpec,
): string {
  const bindSymbol = `Bind${toCppIdentifier(module.name, 'LynxNapiModule')}`;
  const createSymbol = `Create${
    toCppIdentifier(module.name, 'LynxNapiModule')
  }`;
  const callbacks = module.methods.map((method) =>
    generateNapiMethodCallback(method)
  ).join('\n\n');
  const registrations = module.methods.map((method) =>
    `  SetFunction(env, exports, "${method.name}", ${
      toNapiCallbackShimName(method)
    });`
  ).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Edit the method bodies as needed.
#include <lynx/registration.h>

#include "napi.h"

#ifdef USE_WEAK_SUFFIX_NAPI
#include "weak_napi_defines.h"
#endif

namespace {

void Check(napi_env env, napi_status status) {
  if (status != napi_ok) {
    napi_throw_error(env, nullptr, "N-API call failed");
  }
}

void SetFunction(
    napi_env env,
    napi_value object,
    const char* name,
    napi_callback callback) {
  napi_value function;
  Check(env, napi_create_function(
      env, name, NAPI_AUTO_LENGTH, callback, nullptr, &function));
  Check(env, napi_set_named_property(env, object, name, function));
}

${callbacks}

${generateNapiMethodCallbackShims(module)}

void ${bindSymbol}(napi_env env, napi_value exports) {
${registrations}
}

static napi_value ${createSymbol}(
    ::lynx::registration::LynxNapiEnv env,
    ::lynx::registration::LynxNapiValue exports,
    const char* module_name,
    void* opaque) {
  (void)module_name;
  (void)opaque;
  ${bindSymbol}(env, exports);
  return exports;
}

}  // namespace

LYNX_REGISTER_NATIVE_MODULE(
    "${module.name}",
    ${createSymbol},
    nullptr)

#ifdef USE_WEAK_SUFFIX_NAPI
#include "weak_napi_undefs.h"
#endif
`;
}

/**
 * Generates one N-API callback wrapper.
 */
function generateNapiMethodCallback(
  method: NativeModuleMethod,
): string {
  const callbackName = toPascalIdentifier(method.name);
  const methodComment = formatNapiMethodComment(method);

  if (method.params.length === 0) {
    return `Napi::Value ${callbackName}(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
${methodComment}
  return ${defaultNapiReturnExpression(method.returnType)};
}`;
  }

  const args = method.params.map((param, index) => {
    const name = toNapiArgumentIdentifier(param, index);
    return `${formatNapiParamComment(param)}
  ${toNapiCppValueType(param.type)} ${name} = info[${index}].${
      toNapiCppValueCast(param.type)
    };
  (void)${name};`;
  }).join('\n');

  return `Napi::Value ${callbackName}(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
${methodComment}
  if (info.Length() < ${method.params.length}) {
    return env.Undefined();
  }
${args}
  return ${defaultNapiReturnExpression(method.returnType)};
}`;
}

function formatNapiMethodComment(method: NativeModuleMethod): string {
  const lines = [
    '  // Method:',
  ];

  if (method.params.length === 0) {
    lines.push(`  //   ${method.name}(): ${toTsType(method.returnType)}`);
    lines.push(`  // ${formatSourceLocation(method.source)}`);
    return lines.join('\n');
  }

  lines.push(`  //   ${method.name}(`);

  for (const param of method.params) {
    lines.push(`  //     ${param.name}: ${toTsType(param.type)},`);
  }

  lines.push(`  //   ): ${toTsType(method.returnType)}`);
  lines.push(`  // ${formatSourceLocation(method.source)}`);
  return lines.join('\n');
}

function formatNapiParamComment(param: NativeModuleParam): string {
  return `  // Param: ${param.name}: ${toTsType(param.type)}
  // ${formatSourceLocation(param.source)}`;
}

function formatSourceLocation(
  location: NativeModuleSourceLocation | undefined,
): string {
  if (location === undefined) {
    return 'unknown';
  }

  return `${location.file}:${location.line}`;
}

/**
 * Generates C callbacks that adapt N-API entry points to weak-node-api C++ callbacks.
 */
function generateNapiMethodCallbackShims(module: NativeModuleSpec): string {
  return module.methods.map((method) => {
    const callbackName = toPascalIdentifier(method.name);
    const shimName = toNapiCallbackShimName(method);

    return `napi_value ${shimName}(napi_env env, napi_callback_info info) {
  return ${callbackName}(Napi::CallbackInfo(env, info));
}`;
  }).join('\n\n');
}

/**
 * Converts a parsed type into the C++ wrapper value used in generated stubs.
 */
function toNapiCppValueType(type: NativeModuleType): string {
  if (type.nullable) {
    return 'Napi::Value';
  }

  const wrapper = NAPI_CPP_WRAPPER_TYPES[type.name];
  if (wrapper === undefined) {
    throw new Error('void parameters are not supported');
  }

  return wrapper;
}

/**
 * Converts a parsed type into the C++ wrapper cast used in generated stubs.
 */
function toNapiCppValueCast(type: NativeModuleType): string {
  if (type.nullable) {
    return 'As<Napi::Value>()';
  }

  return `As<${toNapiCppValueType(type)}>()`;
}

/**
 * Generates a default return expression for a user-owned NAPI C++ callback stub.
 */
function defaultNapiReturnExpression(type: NativeModuleType): string {
  if (type.nullable) {
    return 'env.Null()';
  }

  switch (type.name) {
    case 'void':
      return 'env.Undefined()';
    case 'string':
      return 'Napi::String::New(env, "")';
    case 'number':
      return 'Napi::Number::New(env, 0)';
    case 'boolean':
      return 'Napi::Boolean::New(env, false)';
    case 'bigint':
      return 'Napi::BigInt::New(env, static_cast<int64_t>(0))';
    case 'date':
      return 'Napi::Date::New(env, 0)';
    case 'array':
      return 'Napi::Array::New(env)';
    case 'arraybuffer':
      return 'Napi::ArrayBuffer::New(env, 0)';
    case 'object':
      return 'Napi::Object::New(env)';
    case 'promise':
      return 'Napi::Promise::Deferred::New(env).Promise()';
    case 'typedarray':
    case 'int8array':
    case 'uint8array':
    case 'int16array':
    case 'uint16array':
    case 'int32array':
    case 'uint32array':
    case 'float32array':
    case 'float64array':
    case 'bigint64array':
    case 'biguint64array':
    case 'dataview':
    case 'function':
    case 'symbol':
    case 'buffer':
    case 'value':
      return 'env.Undefined()';
  }
}

/**
 * Converts a TypeScript parameter name into a safe C++ local variable name.
 */
function toNapiArgumentIdentifier(
  param: NativeModuleParam,
  index: number,
): string {
  const identifier = toCppIdentifier(param.name, `arg${index}`);
  return new Set(['env', 'info', 'argc', 'args']).has(identifier)
    ? `${identifier}_arg`
    : identifier;
}

/**
 * Converts a TypeScript method name into the C callback shim name.
 */
function toNapiCallbackShimName(method: NativeModuleMethod): string {
  return `${toPascalIdentifier(method.name)}Callback`;
}

/**
 * Converts a TypeScript method name into a PascalCase C++ method name.
 */
function toPascalIdentifier(name: string): string {
  const identifier = toCppIdentifier(name, 'Method');
  return `${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}`;
}

/**
 * Converts an identifier-like source into a safe C++ identifier.
 */
function toCppIdentifier(name: string, fallback: string): string {
  const identifier = name.replaceAll(/\W/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_|_$/g, '');
  const safeIdentifier = identifier.length > 0 ? identifier : fallback;

  return /^\d/.test(safeIdentifier) ? `_${safeIdentifier}` : safeIdentifier;
}

/**
 * Generates the Android abstract native module spec for one native module.
 */
function generateAndroidSpec(
  module: NativeModuleSpec,
  packageName: string,
): string {
  const methods = module.methods.map((method) =>
    `  @LynxMethod\n  public abstract ${
      toJavaType(method.returnType)
    } ${method.name}(${
      method.params.map((param) => `${toJavaType(param.type)} ${param.name}`)
        .join(', ')
    });`
  ).join('\n\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
package ${packageName}.generated;

import androidx.annotation.Nullable;
import com.lynx.jsbridge.LynxContextModule;
import com.lynx.jsbridge.LynxMethod;
import com.lynx.tasm.behavior.LynxContext;

public abstract class ${module.name}Spec extends LynxContextModule {
  public ${module.name}Spec(LynxContext context) {
    super(context);
  }

${methods}
}
`;
}

/**
 * Generates the iOS protocol header for one native module.
 */
function generateIosHeader(module: NativeModuleSpec): string {
  const methods = module.methods.map((method) =>
    `- (${toObjCReturnType(method.returnType)})${method.name}${
      method.params.length === 0 ? '' : toObjCParams(method.params)
    };`
  ).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
#import <Foundation/Foundation.h>
#import <Lynx/LynxModule.h>

NS_ASSUME_NONNULL_BEGIN

@protocol ${module.name}Spec <LynxModule>

${methods}

@end

NS_ASSUME_NONNULL_END
`;
}

/**
 * Generates the iOS implementation shim for one native module spec.
 */
function generateIosImplementation(module: NativeModuleSpec): string {
  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
#import "${module.name}Spec.h"
`;
}

/**
 * Generates the Harmony abstract native module spec for one native module.
 */
function generateHarmonySpec(module: NativeModuleSpec): string {
  const methods = module.methods.map((method) =>
    `  abstract ${method.name}(${
      method.params.map((param) =>
        `${param.name}: ${toHarmonyType(param.type, module.name, method.name)}`
      ).join(', ')
    }): ${toHarmonyType(method.returnType, module.name, method.name)};`
  ).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
import { LynxModule } from '@lynx/lynx';

export abstract class ${module.name}Spec extends LynxModule {
${methods}
}
`;
}

/**
 * Converts a parsed native module type to the ArkTS types supported by Harmony Autolink.
 */
function toHarmonyType(
  type: NativeModuleType,
  moduleName: string,
  methodName: string,
): string {
  switch (type.name) {
    case 'void':
      return 'void';
    case 'string':
    case 'number':
    case 'boolean':
      return type.nullable ? `${type.name} | null` : type.name;
    default:
      throw new Error(
        `Unsupported Harmony type "${
          toTsType(type)
        }" for ${moduleName}.${methodName}. Harmony Autolink supports void, string, number, boolean, and nullable primitive values.`,
      );
  }
}

/**
 * Converts a parsed native module type to TypeScript syntax.
 */
function toTsType(type: NativeModuleType): string {
  const source = (type as NativeModuleTypeWithSource).source;
  if (source !== undefined && source.length > 0) {
    return type.nullable ? `${source} | null` : source;
  }

  const base = (() => {
    switch (type.name) {
      case 'void':
      case 'string':
      case 'number':
      case 'boolean':
      case 'object':
        return type.name;
      case 'bigint':
        return 'bigint';
      case 'date':
        return 'Date';
      case 'symbol':
        return 'symbol';
      case 'array':
        return 'unknown[]';
      case 'arraybuffer':
        return 'ArrayBuffer';
      case 'typedarray':
        return 'TypedArray';
      case 'int8array':
        return 'Int8Array';
      case 'uint8array':
        return 'Uint8Array';
      case 'int16array':
        return 'Int16Array';
      case 'uint16array':
        return 'Uint16Array';
      case 'int32array':
        return 'Int32Array';
      case 'uint32array':
        return 'Uint32Array';
      case 'float32array':
        return 'Float32Array';
      case 'float64array':
        return 'Float64Array';
      case 'bigint64array':
        return 'BigInt64Array';
      case 'biguint64array':
        return 'BigUint64Array';
      case 'dataview':
        return 'DataView';
      case 'function':
        return 'Function';
      case 'promise':
        return 'Promise<unknown>';
      case 'buffer':
        return 'Buffer';
      case 'value':
        return 'unknown';
    }
  })();
  return type.nullable ? `${base} | null` : base;
}

/**
 * Converts a parsed native module type to Java syntax.
 */
function toJavaType(type: NativeModuleType): string {
  switch (type.name) {
    case 'void':
      return 'void';
    case 'string':
      return type.nullable ? '@Nullable String' : 'String';
    case 'number':
      return type.nullable ? '@Nullable Double' : 'double';
    case 'boolean':
      return type.nullable ? '@Nullable Boolean' : 'boolean';
    case 'bigint':
    case 'date':
    case 'symbol':
    case 'array':
    case 'arraybuffer':
    case 'typedarray':
    case 'int8array':
    case 'uint8array':
    case 'int16array':
    case 'uint16array':
    case 'int32array':
    case 'uint32array':
    case 'float32array':
    case 'float64array':
    case 'bigint64array':
    case 'biguint64array':
    case 'dataview':
    case 'object':
    case 'function':
    case 'promise':
    case 'buffer':
    case 'value':
      return type.nullable ? '@Nullable Object' : 'Object';
  }
}

/**
 * Converts a parsed native module type to an Objective-C return type.
 */
function toObjCReturnType(type: NativeModuleType): string {
  switch (type.name) {
    case 'void':
      return 'void';
    case 'string':
      return type.nullable ? 'nullable NSString *' : 'NSString *';
    case 'number':
      return type.nullable ? 'nullable NSNumber *' : 'double';
    case 'boolean':
      return type.nullable ? 'nullable NSNumber *' : 'BOOL';
    case 'bigint':
    case 'date':
    case 'symbol':
    case 'array':
    case 'arraybuffer':
    case 'typedarray':
    case 'int8array':
    case 'uint8array':
    case 'int16array':
    case 'uint16array':
    case 'int32array':
    case 'uint32array':
    case 'float32array':
    case 'float64array':
    case 'bigint64array':
    case 'biguint64array':
    case 'dataview':
    case 'object':
    case 'function':
    case 'promise':
    case 'buffer':
    case 'value':
      return type.nullable ? 'nullable id' : 'id';
  }
}

/**
 * Converts a parsed native module type to an Objective-C parameter type.
 */
function toObjCParamType(type: NativeModuleType): string {
  switch (type.name) {
    case 'void':
      throw new Error('void parameters are not supported');
    case 'string':
      return type.nullable ? 'nullable NSString *' : 'NSString *';
    case 'number':
      return type.nullable ? 'nullable NSNumber *' : 'double';
    case 'boolean':
      return type.nullable ? 'nullable NSNumber *' : 'BOOL';
    case 'bigint':
    case 'date':
    case 'symbol':
    case 'array':
    case 'arraybuffer':
    case 'typedarray':
    case 'int8array':
    case 'uint8array':
    case 'int16array':
    case 'uint16array':
    case 'int32array':
    case 'uint32array':
    case 'float32array':
    case 'float64array':
    case 'bigint64array':
    case 'biguint64array':
    case 'dataview':
    case 'object':
    case 'function':
    case 'promise':
    case 'buffer':
    case 'value':
      return type.nullable ? 'nullable id' : 'id';
  }
}

/**
 * Converts parsed parameters into an Objective-C selector suffix.
 */
function toObjCParams(params: NativeModuleParam[]): string {
  return params.map((param, index) => {
    const prefix = index === 0 ? ':' : ` ${param.name}:`;
    return `${prefix}(${toObjCParamType(param.type)})${param.name}`;
  }).join('');
}

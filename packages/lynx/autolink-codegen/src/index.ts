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
  | 'named-object'
  | 'value';

export interface NativeModuleType {
  name: NativeModuleTypeName;
  nullable: boolean;
  referenceName?: string;
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
  optional?: boolean;
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
  interfaces?: NativeModuleObjectSpec[];
  source?: NativeModuleSourceLocation;
}

export interface NativeModuleObjectProperty {
  name: string;
  type: NativeModuleType;
  optional?: boolean;
}

export interface NativeModuleObjectSpec {
  name: string;
  properties: NativeModuleObjectProperty[];
}

export interface LynxtronRuntimeArtifact {
  os: string;
  arch: string;
  path: string | string[];
}

export interface LynxtronLegacyBinaryArtifact {
  os: string;
  arch?: string;
  arc?: string;
  path: string | string[];
}

export interface LynxtronPlatformManifest {
  path?: string | string[];
  /** @deprecated Use `binaries` instead. */
  binary?: LynxtronLegacyBinaryArtifact | LynxtronLegacyBinaryArtifact[];
  binaries?: LynxtronRuntimeArtifact[];
  frameworks?: LynxtronRuntimeArtifact[];
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
      packageDir: string;
    };
    lynxtron?: LynxtronPlatformManifest;
  };
}

const MODULE_HEADER_PATTERN =
  /\/\*\*[\s\S]*?@lynxmodule[\s\S]*?\*\/\s*export\s+declare\s+class\s+([A-Za-z_$][\w$]*)\s*\{/g;
const INTERFACE_HEADER_PATTERN =
  /export\s+interface\s+([A-Za-z_$][\w$]*)\s*\{/g;
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
  'named-object': 'Napi::Object',
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
  const interfaces = parseObjectInterfaces(source, sourceFilename);
  const interfaceNames = new Set(interfaces.map((object) => object.name));
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
      methods: parseMethods(
        body,
        sourceFilename,
        moduleName,
        bodyStartLine,
        interfaceNames,
      ),
      ...(interfaces.length > 0 ? { interfaces } : {}),
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

function parseObjectInterfaces(
  source: string,
  filename: string,
): NativeModuleObjectSpec[] {
  const declarations: Array<{
    closeBraceIndex: number;
    name: string;
    openBraceIndex: number;
  }> = [];
  const interfaceNames = new Set<string>();
  const pattern = new RegExp(INTERFACE_HEADER_PATTERN);
  let match = pattern.exec(source);

  while (match !== null) {
    const name = match[1];
    const matchedHeader = match[0];
    if (name === undefined) {
      match = pattern.exec(source);
      continue;
    }
    if (interfaceNames.has(name)) {
      throw new Error(`Duplicate interface "${name}" in ${filename}`);
    }
    interfaceNames.add(name);

    const openBraceIndex = match.index + matchedHeader.length - 1;
    const closeBraceIndex = findMatchingBrace(source, openBraceIndex);
    if (closeBraceIndex === -1) {
      throw new Error(
        `Invalid interface declaration in ${filename}: ${name} is missing a closing brace`,
      );
    }

    declarations.push({
      closeBraceIndex,
      name,
      openBraceIndex,
    });
    pattern.lastIndex = closeBraceIndex + 1;
    match = pattern.exec(source);
  }

  return declarations.map(({ closeBraceIndex, name, openBraceIndex }) => ({
    name,
    properties: parseObjectProperties(
      source.slice(openBraceIndex + 1, closeBraceIndex),
      filename,
      name,
      interfaceNames,
    ),
  }));
}

function parseObjectProperties(
  body: string,
  filename: string,
  interfaceName: string,
  interfaceNames: ReadonlySet<string>,
): NativeModuleObjectProperty[] {
  const source = stripTypeScriptComments(body);
  const declarations = source.split(/[;\n]/).map((entry) => entry.trim())
    .filter(Boolean);
  const properties: NativeModuleObjectProperty[] = [];
  const seen = new Set<string>();

  for (const declaration of declarations) {
    const colon = declaration.indexOf(':');
    if (colon <= 0 || colon === declaration.length - 1) {
      throw new Error(
        `Invalid property declaration in ${filename}: ${interfaceName}.${declaration}`,
      );
    }
    const rawName = declaration.slice(0, colon).trim();
    const optional = rawName.endsWith('?');
    const name = optional ? rawName.slice(0, -1).trim() : rawName;
    const typeSource = declaration.slice(colon + 1).trim();
    if (!IDENTIFIER_PATTERN.test(name) || typeSource.length === 0) {
      throw new Error(
        `Invalid property declaration in ${filename}: ${interfaceName}.${declaration}`,
      );
    }
    if (seen.has(name)) {
      throw new Error(
        `Duplicate property "${interfaceName}.${name}" in ${filename}`,
      );
    }
    seen.add(name);

    const type = parseType(
      typeSource,
      filename,
      `${interfaceName}.${name}`,
      interfaceNames,
    );
    if (type.name === 'void') {
      throw new Error(
        `Unsupported property type "void" for ${interfaceName}.${name} in ${filename}`,
      );
    }
    properties.push({
      name,
      type,
      ...(optional ? { optional: true } : {}),
    });
  }

  return properties;
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
 * Builds the generated JS facade and platform spec file contents for a library package.
 */
export function generate(options: CodegenOptions = {}): GeneratedFile[] {
  const root = path.resolve(options.root ?? process.cwd());
  const manifest = readManifest(root);
  const { napiModules, platformModules } = readNativeModuleSpecs(root);
  if (napiModules.length > 1) {
    throw new Error(
      'Only one Node-API native module declaration is supported per Lynx library',
    );
  }
  const seenModules = new Set<string>();
  const files: GeneratedFile[] = [];

  for (const module of platformModules) {
    if (seenModules.has(module.name)) {
      throw new Error(`Duplicate native module "${module.name}" across types`);
    }
    seenModules.add(module.name);
    validatePlatformModuleSpec(module);

    files.push({
      path: path.posix.join('generated', `${module.name}.ts`),
      content: generateUnifiedJsFacade(module, false, false),
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
          manifest.platforms.harmony.packageDir,
          'src',
          'main',
          'ets',
          'generated',
          `${module.name}Spec.ets`,
        ),
        content: generateHarmonySpec(module),
      });
    }

    if (manifest.platforms.lynxtron !== undefined) {
      files.push(...generateNapiNativeModuleFiles(module));
    }
  }

  for (const module of napiModules) {
    if (seenModules.has(module.name)) {
      throw new Error(`Duplicate native module "${module.name}" across types`);
    }
    seenModules.add(module.name);

    files.push({
      path: path.posix.join('generated', `${module.name}.ts`),
      content: generateUnifiedJsFacade(module, true, true),
    });
    files.push(...generateNapiNativeModuleFiles(module));
    files.push({
      path: path.posix.join(
        'shared',
        'nativeModule',
        'generated',
        `${module.name}Registration.cc`,
      ),
      content: generateNapiNativeModuleRegistration(module),
    });
  }

  if (
    napiModules.length > 0
    || (
      platformModules.length > 0
      && manifest.platforms.lynxtron !== undefined
    )
  ) {
    files.push({
      path: path.posix.join('shared', 'nativeModule', 'CMakeLists.txt'),
      content: generateNapiNativeModuleCMake(),
    });
  }

  if (napiModules.length > 0) {
    if (manifest.platforms.ios !== undefined) {
      files.push({
        path: path.posix.join(
          manifest.platforms.ios.sourceDir,
          'addon_use.h',
        ),
        content: generateNapiAddonUseHeader(napiModules),
      });
    }
    if (manifest.platforms.lynxtron !== undefined) {
      files.push({
        path: path.posix.join(
          'lynxtron',
          'generated_napi_registration.cc',
        ),
        content: generateNapiLynxtronRegistration(napiModules),
      });
    }
    if (manifest.platforms.ios !== undefined) {
      const module = napiModules[0];
      if (module === undefined) {
        throw new Error('Missing Node-API native module declaration');
      }
      const wrapperPath = path.posix.join(
        manifest.platforms.ios.sourceDir,
        'generated',
        `${module.name}NapiWrapper.cc`,
      );
      files.push({
        path: wrapperPath,
        content: generateNapiIosWrapper(module, wrapperPath),
      });
    }
  }

  if (
    platformModules.length > 0
    && manifest.platforms.lynxtron !== undefined
  ) {
    files.push({
      path: path.posix.join(
        'lynxtron',
        'generated_platform_registration.cc',
      ),
      content: generatePlatformLynxtronRegistration(platformModules),
    });
  }

  return files;
}

function validatePlatformModuleSpec(module: NativeModuleSpec): void {
  for (const method of module.methods) {
    if (method.params.some((param) => param.optional)) {
      throw new Error(
        `Optional parameters require the Node-API backend: ${module.name}.${method.name}`,
      );
    }
    if (
      method.returnType.name === 'named-object'
      || method.params.some((param) => param.type.name === 'named-object')
    ) {
      throw new Error(
        `Named object interfaces require the Node-API backend: ${module.name}.${method.name}`,
      );
    }
  }
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
  interfaceNames: ReadonlySet<string>,
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
        interfaceNames,
      ),
      returnType: parseType(
        returnSource.trim(),
        filename,
        `${moduleName}.${methodName} return`,
        interfaceNames,
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
  interfaceNames: ReadonlySet<string>,
): NativeModuleParam[] {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const params = splitTypeScriptParameterList(trimmed).filter((paramSource) =>
    paramSource.trim().length > 0
  );

  let sawOptional = false;
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
    if (!optional && sawOptional) {
      throw new Error(
        `Required parameter "${moduleName}.${methodName}.${name}" cannot follow an optional parameter`,
      );
    }
    sawOptional ||= optional;

    const type = parseType(
      typeSource,
      filename,
      `${moduleName}.${methodName}.${name}`,
      interfaceNames,
    );

    if (type.name === 'void') {
      throw new Error(
        `Unsupported parameter type "void" for ${moduleName}.${methodName}.${name} in ${filename}. Lynx library codegen v1 only supports void as a return type.`,
      );
    }

    return {
      name,
      type,
      ...(optional ? { optional: true } : {}),
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
  interfaceNames: ReadonlySet<string> = new Set(),
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

  if (name === undefined && interfaceNames.has(nonNullTypeSource)) {
    return withTypeSource({
      name: 'named-object',
      nullable,
      referenceName: nonNullTypeSource,
    }, nonNullTypeSource);
  }

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
      packageDir: readOptionalString(
        harmony,
        'packageDir',
        manifestPath,
        'platforms.harmony.packageDir',
      ) ?? 'harmony',
    };
  }

  if (lynxtron !== undefined) {
    normalizedPlatforms.lynxtron = readLynxtronPlatform(
      lynxtron,
      manifestPath,
    );
  }

  return {
    platforms: normalizedPlatforms,
  };
}

/**
 * Reads and validates the Lynxtron native artifact declarations.
 */
function readLynxtronPlatform(
  value: Record<string, unknown>,
  manifestPath: string,
): LynxtronPlatformManifest {
  const normalized: LynxtronPlatformManifest = {};
  const artifactRoot = value['path'];
  const legacyBinary = value['binary'];
  const binaries = value['binaries'];
  const frameworks = value['frameworks'];

  if (artifactRoot !== undefined) {
    normalized.path = readStringPaths(
      artifactRoot,
      manifestPath,
      'platforms.lynxtron.path',
    );
  }

  if (legacyBinary !== undefined && binaries !== undefined) {
    throw new Error(
      `${manifestPath} cannot define both "platforms.lynxtron.binary" and "platforms.lynxtron.binaries"`,
    );
  }

  if (legacyBinary !== undefined) {
    const entries = Array.isArray(legacyBinary)
      ? legacyBinary
      : [legacyBinary];
    normalized.binary = readLynxtronArtifacts(
      entries,
      manifestPath,
      'platforms.lynxtron.binary',
      true,
    );
  }

  if (binaries !== undefined) {
    normalized.binaries = readLynxtronArtifactArray(
      binaries,
      manifestPath,
      'platforms.lynxtron.binaries',
    );
  }

  if (frameworks !== undefined) {
    normalized.frameworks = readLynxtronArtifactArray(
      frameworks,
      manifestPath,
      'platforms.lynxtron.frameworks',
    );
  }

  return normalized;
}

/**
 * Reads a required array of platform-selected Lynxtron artifacts.
 */
function readLynxtronArtifactArray(
  value: unknown,
  manifestPath: string,
  displayPath: string,
): LynxtronRuntimeArtifact[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `${manifestPath} must define non-empty array "${displayPath}"`,
    );
  }

  return readLynxtronArtifacts(value, manifestPath, displayPath, false);
}

/**
 * Validates a list of platform-selected Lynxtron artifacts.
 */
function readLynxtronArtifacts(
  entries: unknown[],
  manifestPath: string,
  displayPath: string,
  allowLegacyArc: false,
): LynxtronRuntimeArtifact[];
function readLynxtronArtifacts(
  entries: unknown[],
  manifestPath: string,
  displayPath: string,
  allowLegacyArc: true,
): LynxtronLegacyBinaryArtifact[];
function readLynxtronArtifacts(
  entries: unknown[],
  manifestPath: string,
  displayPath: string,
  allowLegacyArc: boolean,
): Array<LynxtronRuntimeArtifact | LynxtronLegacyBinaryArtifact> {
  if (entries.length === 0) {
    throw new Error(
      `${manifestPath} must define at least one entry in "${displayPath}"`,
    );
  }

  return entries.map((entry, index) => {
    const entryPath = `${displayPath}[${index}]`;
    if (!isRecord(entry)) {
      throw new Error(`${manifestPath} must define object "${entryPath}"`);
    }

    const os = readRequiredString(entry, 'os', manifestPath, `${entryPath}.os`);
    const arch = readOptionalString(
      entry,
      'arch',
      manifestPath,
      `${entryPath}.arch`,
    );
    const arc = allowLegacyArc
      ? readOptionalString(
        entry,
        'arc',
        manifestPath,
        `${entryPath}.arc`,
      )
      : undefined;

    if (arch === undefined && arc === undefined) {
      throw new Error(
        `${manifestPath} must define string "${entryPath}.arch"`,
      );
    }
    if (arch !== undefined && arc !== undefined) {
      throw new Error(
        `${manifestPath} cannot define both "${entryPath}.arch" and "${entryPath}.arc"`,
      );
    }

    const artifactPath = readStringPaths(
      entry['path'],
      manifestPath,
      `${entryPath}.path`,
    );

    if (arch !== undefined) {
      return { os, arch, path: artifactPath };
    }

    return { os, arc: arc!, path: artifactPath };
  });
}

/**
 * Reads one or more non-empty relative artifact paths.
 */
function readStringPaths(
  value: unknown,
  manifestPath: string,
  displayPath: string,
): string | string[] {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (
    Array.isArray(value) && value.length > 0
    && value.every(
      (item: unknown): item is string =>
        typeof item === 'string' && item.trim().length > 0,
    )
  ) {
    return value;
  }

  throw new Error(
    `${manifestPath} must define non-empty string or string array "${displayPath}"`,
  );
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
 * Generates the TypeScript facade shared by platform and Node-API backends.
 */
function generateUnifiedJsFacade(
  module: NativeModuleSpec,
  supportsNodeApi: boolean,
  installNodeApiShim: boolean,
): string {
  const methods = module.methods.map((method) =>
    `  ${method.name}(${
      method.params.map((param) =>
        `${param.name}${param.optional ? '?' : ''}: ${toTsType(param.type)}`
      )
        .join(
          ', ',
        )
    }): ${toTsType(method.returnType)};`
  ).join('\n');
  const interfaces = (module.interfaces ?? []).map((object) =>
    `export interface ${object.name} {
${
      object.properties.map((property) =>
        `  ${property.name}${property.optional ? '?' : ''}: ${
          toTsType(property.type)
        };`
      ).join('\n')
    }
}`
  ).join('\n\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.

const ADDON_NAME = ${JSON.stringify(module.name)};

${
    interfaces.length > 0
      ? `${interfaces}\n\n`
      : ''
  }export interface ${module.name}Spec {
${methods}
}

type AddonExports = Record<string, unknown>;

declare let NativeModules: Record<string, unknown>;

declare global {
  interface LynxNapiLoader {
    load(moduleName: string): AddonExports | null | undefined;
  }

  // eslint-disable-next-line no-var
  var __lynxNapiLoader: LynxNapiLoader | undefined;

  function getNapiLoader(): LynxNapiLoader | undefined;
}

declare const lynx: {
  getModuleLoader?(): LynxNapiLoader | undefined;
};

function getNativeModules(): Record<string, unknown> | undefined {
  const globalObject = globalThis as typeof globalThis & {
    NativeModules?: Record<string, unknown>;
  };
  return typeof NativeModules !== 'undefined'
    ? NativeModules
    : globalObject.NativeModules;
}

${
    installNodeApiShim
      ? `function setNativeModules(nativeModules: Record<string, unknown>): void {
  if (typeof NativeModules !== 'undefined') {
    NativeModules = nativeModules;
    return;
  }
  const globalObject = globalThis as typeof globalThis & {
    NativeModules?: Record<string, unknown>;
  };
  globalObject.NativeModules = nativeModules;
}

`
      : ''
  }${
    supportsNodeApi
      ? `type AddonLoadResult =
  | { addon: AddonExports | undefined }
  | { error: unknown };

let cachedAddon: AddonExports | undefined;

function loadNodeApiAddon(): AddonExports | undefined {
  if (cachedAddon !== undefined) {
    return cachedAddon;
  }
  const loader = globalThis.getNapiLoader?.()
    ?? globalThis.__lynxNapiLoader
    ?? (typeof lynx !== 'undefined' ? lynx.getModuleLoader?.() : undefined);
  if (loader?.load === undefined) {
    return undefined;
  }
  const addon = loader.load(ADDON_NAME);
  if (addon === undefined || addon === null) {
    return undefined;
  }
  cachedAddon = addon;
  return cachedAddon;
}

function tryLoadNodeApiAddon(): AddonLoadResult {
  try {
    return { addon: loadNodeApiAddon() };
  } catch (error) {
    return { error };
  }
}

`
      : ''
  }${
    installNodeApiShim
      ? `let nativeModulesBeforeShim: Record<string, unknown> | undefined;

`
      : ''
  }function install${module.name}Shim(): void {
${
    installNodeApiShim
      ? `  nativeModulesBeforeShim = getNativeModules();
  setNativeModules(new Proxy({}, {
    get(_target, property) {
      if (property === ADDON_NAME) {
        const existingModule = nativeModulesBeforeShim === undefined
          ? undefined
          : Reflect.get(nativeModulesBeforeShim, property);
        if (existingModule !== undefined && existingModule !== null) {
          return existingModule;
        }
        const loadResult = tryLoadNodeApiAddon();
        if ('addon' in loadResult && loadResult.addon !== undefined) {
          return loadResult.addon;
        }
        if ('error' in loadResult) {
          throw loadResult.error;
        }
        return existingModule;
      }
      return nativeModulesBeforeShim === undefined
        ? undefined
        : Reflect.get(nativeModulesBeforeShim, property);
    },
    has(_target, property) {
      return nativeModulesBeforeShim === undefined
        ? false
        : Reflect.has(nativeModulesBeforeShim, property);
    },
    ownKeys() {
      return nativeModulesBeforeShim === undefined
        ? []
        : Reflect.ownKeys(nativeModulesBeforeShim);
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = nativeModulesBeforeShim === undefined
        ? undefined
        : Reflect.getOwnPropertyDescriptor(nativeModulesBeforeShim, property);
      return descriptor === undefined
        ? undefined
        : { ...descriptor, configurable: true };
    },
  }));
`
      : ''
  }
}

export function require${module.name}(): ${module.name}Spec {
  const nativeModules = ${
    installNodeApiShim ? 'nativeModulesBeforeShim' : 'getNativeModules()'
  };
  const existingModule = nativeModules?.[ADDON_NAME];
  if (existingModule !== undefined && existingModule !== null) {
    return existingModule as ${module.name}Spec;
  }

${
    installNodeApiShim
      ? `  const loadResult = tryLoadNodeApiAddon();
  if ('addon' in loadResult && loadResult.addon !== undefined) {
    return loadResult.addon as unknown as ${module.name}Spec;
  }
  if ('error' in loadResult) {
    throw loadResult.error;
  }
`
      : ''
  }${
    supportsNodeApi && !installNodeApiShim
      ? `  const addon = loadNodeApiAddon();
  if (addon !== undefined) {
    return addon as unknown as ${module.name}Spec;
  }
`
      : ''
  }

  throw new Error(\`Native module "\${ADDON_NAME}" is unavailable.\`);
}

export const ${module.name} = new Proxy({}, {
  get(_target, property) {
    return require${module.name}()[property as keyof ${module.name}Spec];
  },
}) as ${module.name}Spec;

install${module.name}Shim();

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
 * Generates the iOS CocoaPods-owned wrapper that compiles the shared NAPI module
 * from inside the iOS pod source root.
 */
function generateNapiIosWrapper(
  module: NativeModuleSpec,
  wrapperPath: string,
): string {
  const implementationPath = path.posix.join(
    'shared',
    'nativeModule',
    `${module.name}.cc`,
  );
  const includePath = path.posix.relative(
    path.posix.dirname(wrapperPath),
    implementationPath,
  );
  const registrationPath = path.posix.join(
    'shared',
    'nativeModule',
    'generated',
    `${module.name}Registration.cc`,
  );
  const registrationIncludePath = path.posix.relative(
    path.posix.dirname(wrapperPath),
    registrationPath,
  );

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
#include "${includePath}"
#include "${registrationIncludePath}"
`;
}

/**
 * Generates the iOS registration references that keep every NAPI module alive.
 */
function generateNapiAddonUseHeader(modules: NativeModuleSpec[]): string {
  const registrations = modules.map((module) => `NAPI_USE(${module.name})`)
    .join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
#pragma once

#if __has_include(<LynxWeakNodeAPI/headers/node_api.h>)
#include <LynxWeakNodeAPI/headers/node_api.h>
#else
#include "node_api.h"
#endif

#if defined(USE_WEAK_SUFFIX_NAPI)
#if __has_include(<LynxWeakNodeAPI/headers/weak_napi_defines.h>)
#include <LynxWeakNodeAPI/headers/weak_napi_defines.h>
#else
#include "weak_napi_defines.h"
#endif
#endif

#ifndef NAPI_USE
#define NAPI_USE(modname)                                                 \\
  EXTERN_C_START                                                          \\
  extern void _napi_register_xx_##modname(void);                          \\
  __attribute__((used)) static void* _napi_module_##modname##_p =         \\
      (void*)&_napi_register_xx_##modname;                                 \\
  EXTERN_C_END
#endif

${registrations}

#if defined(USE_WEAK_SUFFIX_NAPI)
#if __has_include(<LynxWeakNodeAPI/headers/weak_napi_undefs.h>)
#include <LynxWeakNodeAPI/headers/weak_napi_undefs.h>
#else
#include "weak_napi_undefs.h"
#endif
#endif
`;
}

/**
 * Generates the Lynxtron entry that registers platform native module creators.
 */
function generatePlatformLynxtronRegistration(
  modules: NativeModuleSpec[],
): string {
  const declarations = modules.map((module) => {
    const creatorSymbol = `LynxAutolinkCreate${
      toCppIdentifier(module.name, 'LynxNapiModule')
    }`;
    return `extern "C" NodeValue ${creatorSymbol}(
    NodeEnv env,
    NodeValue exports,
    const char* module_name,
    void* opaque);`;
  }).join('\n\n');
  const registrations = modules.map((module) => {
    const creatorSymbol = `LynxAutolinkCreate${
      toCppIdentifier(module.name, 'LynxNapiModule')
    }`;
    return `  lynx_env_register_native_module(
      ${JSON.stringify(module.name)}, ${creatorSymbol}, nullptr);`;
  }).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
using NodeEnv = void*;
using NodeValue = void*;
using LynxLibraryNapiModuleCreator = NodeValue (*)(
    NodeEnv env,
    NodeValue exports,
    const char* module_name,
    void* opaque);

${declarations}

extern "C" void lynx_env_register_native_module(
    const char* name,
    LynxLibraryNapiModuleCreator creator,
    void* opaque);

extern "C" void LynxAutolinkRegisterPlatformNativeModules() {
${registrations}
}
`;
}

/**
 * Generates the Lynxtron entry that registers standard Node-API modules.
 */
function generateNapiLynxtronRegistration(
  modules: NativeModuleSpec[],
): string {
  const declarations = modules.map((module) =>
    `extern "C" void _napi_register_xx_${module.name}(void);`
  ).join('\n');
  const registrations = modules.map((module) =>
    `  _napi_register_xx_${module.name}();`
  ).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
${declarations}

extern "C" void LynxAutolinkRegisterNapiNativeModules() {
${registrations}
}
`;
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
  "\${LYNX_WEAK_NODE_API_HEADERS_DIR}"
  "\${LYNX_EXTENSION_HEADERS_DIR}/include"
)

if(LYNX_LIBRARY_NODE_API_WEAK_SUFFIX)
  target_compile_definitions(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    USE_WEAK_SUFFIX_NAPI=1
  )
endif()

if(LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE)
  target_compile_definitions(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE=1
  )
endif()

if(LYNX_LIBRARY_MANUAL_NAPI_REGISTRATION)
  target_compile_definitions(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    LYNX_LIBRARY_MANUAL_NAPI_REGISTRATION=1
  )
endif()

if(LYNX_SHARED_PLATFORM_COMPILE_DEFINITIONS)
  target_compile_definitions(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    \${LYNX_SHARED_PLATFORM_COMPILE_DEFINITIONS}
  )
endif()

if(LYNX_SHARED_PLATFORM_LINK_LIBRARIES)
  target_link_libraries(\${LYNX_LIBRARY_NAPI_NATIVE_MODULE_TARGET} PRIVATE
    \${LYNX_SHARED_PLATFORM_LINK_LIBRARIES}
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
  const lynxCreatorSymbol = `LynxAutolinkCreate${
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
#if __has_include(<LynxWeakNodeAPI/headers/napi.h>)
#include <LynxWeakNodeAPI/headers/napi.h>
#else
#include "napi.h"
#endif

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

static napi_value ${createSymbol}(napi_env env, napi_value exports) {
  ${bindSymbol}(env, exports);
  return exports;
}

}  // namespace

extern "C" napi_value ${lynxCreatorSymbol}(
    napi_env env,
    napi_value exports,
    const char* module_name,
    void* opaque) {
  (void)module_name;
  (void)opaque;
  return ${createSymbol}(env, exports);
}

#ifdef USE_WEAK_SUFFIX_NAPI
#include "weak_napi_undefs.h"
#endif
`;
}

/**
 * Generates platform registration around the stable user-owned creator.
 */
function generateNapiNativeModuleRegistration(
  module: NativeModuleSpec,
): string {
  const identifier = toCppIdentifier(module.name, 'LynxNapiModule');
  const creatorSymbol = `LynxAutolinkCreate${identifier}`;
  const registerSymbol = `LynxAutolinkRegister${identifier}`;

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
#if __has_include(<LynxWeakNodeAPI/headers/napi.h>)
#include <LynxWeakNodeAPI/headers/napi.h>
#else
#include "napi.h"
#endif

#if defined(USE_WEAK_SUFFIX_NAPI)
#include "weak_napi_defines.h"
#endif

extern "C" napi_value ${creatorSymbol}(
    napi_env env,
    napi_value exports,
    const char* module_name,
    void* opaque);

#if defined(LYNX_LIBRARY_USE_PRIMJS_NAPI_MODULE)
namespace {

napi_value ${registerSymbol}(napi_env env, napi_value exports) {
  return ${creatorSymbol}(
      env, exports, ${JSON.stringify(module.name)}, nullptr);
}

napi_module g_module = {
    NAPI_MODULE_VERSION,
    0,
    __FILE__,
    ${registerSymbol},
    ${JSON.stringify(module.name)},
    nullptr,
    {nullptr, nullptr, nullptr, nullptr}};

}  // namespace

#if defined(LYNX_LIBRARY_MANUAL_NAPI_REGISTRATION)
#define LYNX_NAPI_REGISTRATION_ATTRIBUTE
#else
#define LYNX_NAPI_REGISTRATION_ATTRIBUTE __attribute__((constructor))
#endif

extern "C" void _napi_register_xx_${module.name}(void)
    LYNX_NAPI_REGISTRATION_ATTRIBUTE;
extern "C" void _napi_register_xx_${module.name}(void) {
  napi_module_register(&g_module);
}
#endif

#if defined(USE_WEAK_SUFFIX_NAPI)
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

  const requiredParamCount = (() => {
    const firstOptional = method.params.findIndex((param) => param.optional);
    return firstOptional === -1 ? method.params.length : firstOptional;
  })();
  const args = method.params.map((param, index) => {
    const name = toNapiArgumentIdentifier(param, index);
    if (param.optional) {
      return `${formatNapiParamComment(param)}
  Napi::Value ${name} = info.Length() > ${index}
      ? info[${index}].As<Napi::Value>()
      : env.Undefined();
  (void)${name};`;
    }
    return `${formatNapiParamComment(param)}
  ${toNapiCppValueType(param.type)} ${name} = info[${index}].${
      toNapiCppValueCast(param.type)
    };
  (void)${name};`;
  }).join('\n');

  return `Napi::Value ${callbackName}(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
${methodComment}
  if (info.Length() < ${requiredParamCount}) {
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
    case 'named-object':
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

/** Generates the Harmony ArkTS abstract native module spec. */
function generateHarmonySpec(module: NativeModuleSpec): string {
  const methods = module.methods.map((method) => {
    for (const param of method.params) {
      assertHarmonyType(
        param.type,
        module,
        `${method.name}.${param.name}`,
      );
    }
    assertHarmonyType(method.returnType, module, `${method.name} return`);

    return `  abstract ${method.name}(${
      method.params.map((param) =>
        `${param.name}: ${toHarmonyType(param.type)}`
      ).join(', ')
    }): ${toHarmonyType(method.returnType)};`;
  }).join('\n');

  return `// Generated by @lynx-js/autolink-codegen. Do not edit.
import { LynxModule } from '@lynx/lynx';

export abstract class ${module.name}Spec extends LynxModule {
${methods}
}
`;
}

function assertHarmonyType(
  type: NativeModuleType,
  module: NativeModuleSpec,
  context: string,
): void {
  if (
    type.name !== 'void' && type.name !== 'string' && type.name !== 'number'
    && type.name !== 'boolean'
  ) {
    throw new Error(
      `Unsupported Harmony type "${
        toTsType(type)
      }" for ${module.name}.${context}. Harmony Native Module codegen supports void, string, number, boolean, and nullable primitive types.`,
    );
  }
}

function toHarmonyType(type: NativeModuleType): string {
  const base = type.name;
  return type.nullable ? `${base} | null` : base;
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
      case 'named-object':
        return type.referenceName ?? 'object';
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
    case 'named-object':
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
    case 'named-object':
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
    case 'named-object':
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

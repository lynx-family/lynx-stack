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
}

export type NativeModuleTypeName = 'void' | 'string' | 'number' | 'boolean';

export interface NativeModuleType {
  name: NativeModuleTypeName;
  nullable: boolean;
}

export interface NativeModuleParam {
  name: string;
  type: NativeModuleType;
}

export interface NativeModuleMethod {
  name: string;
  params: NativeModuleParam[];
  returnType: NativeModuleType;
}

export interface NativeModuleSpec {
  name: string;
  methods: NativeModuleMethod[];
}

interface LynxLibJson {
  platforms: {
    android: {
      packageName: string;
      sourceDir: string;
    };
    ios: {
      sourceDir: string;
    };
  };
}

const MODULE_HEADER_PATTERN =
  /\/\*\*[\s\S]*?@lynxmodule[\s\S]*?\*\/\s*export\s+declare\s+class\s+([A-Za-z_$][\w$]*)\s*\{/g;
const IDENTIFIER_PATTERN = /^[A-Z_$][\w$]*$/i;
const JAVA_PACKAGE_NAME_PATTERN = /^[A-Z_]\w*(?:\.[A-Z_]\w*)*$/i;

/**
 * Parses native module declarations marked with `@lynxmodule` from a TypeScript declaration source.
 */
export function parseNativeModules(
  source: string,
  filename = '<inline>',
): NativeModuleSpec[] {
  const modules: NativeModuleSpec[] = [];
  const seen = new Set<string>();

  for (
    const { body, name: moduleName } of findNativeModuleDeclarations(
      source,
      filename,
    )
  ) {
    if (seen.has(moduleName)) {
      throw new Error(`Duplicate native module "${moduleName}" in ${filename}`);
    }
    seen.add(moduleName);

    modules.push({
      name: moduleName,
      methods: parseMethods(body, filename, moduleName),
    });
  }

  return modules;
}

/**
 * Finds native module declarations and captures class bodies while ignoring braces in comments and strings.
 */
function findNativeModuleDeclarations(
  source: string,
  filename: string,
): Array<{ name: string; body: string }> {
  const declarations: Array<{ name: string; body: string }> = [];
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
    });

    pattern.lastIndex = closeBraceIndex + 1;
    match = pattern.exec(source);
  }

  return declarations;
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
  const modules = readNativeModuleSpecs(root);
  const seenModules = new Set<string>();
  const files: GeneratedFile[] = [];

  for (const module of modules) {
    if (seenModules.has(module.name)) {
      throw new Error(`Duplicate native module "${module.name}" across types`);
    }
    seenModules.add(module.name);

    files.push({
      path: path.posix.join('generated', `${module.name}.ts`),
      content: generateJsFacade(module),
    });
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
): NativeModuleMethod[] {
  const methods: NativeModuleMethod[] = [];
  const seen = new Set<string>();

  for (const trimmed of splitMethodDeclarations(body, filename, moduleName)) {
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
      params: parseParams(paramsSource, filename, moduleName, methodName),
      returnType: parseType(
        returnSource.trim(),
        filename,
        `${moduleName}.${methodName} return`,
      ),
    });
  }

  return methods;
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
): string[] {
  const declarations: string[] = [];
  const source = stripTypeScriptComments(body);
  let buffer = '';

  for (const line of source.split(/\r?\n/)) {
    const parts = line.split(';');

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]?.trim();

      if (part !== undefined && part.length > 0) {
        buffer = `${buffer} ${part}`.trim();
      }

      if (
        buffer.length > 0
        && (index < parts.length - 1 || isCompleteMethodDeclaration(buffer))
      ) {
        declarations.push(buffer);
        buffer = '';
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
): NativeModuleParam[] {
  const trimmed = source.trim();

  if (trimmed.length === 0) {
    return [];
  }

  const params = trimmed.split(',').filter((paramSource) =>
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
        `Optional parameter "${moduleName}.${methodName}.${name}" is not supported by Native Autolink codegen v1`,
      );
    }

    const type = parseType(
      typeSource,
      filename,
      `${moduleName}.${methodName}.${name}`,
    );

    if (type.name === 'void') {
      throw new Error(
        `Unsupported parameter type "void" for ${moduleName}.${methodName}.${name} in ${filename}. Native Autolink codegen v1 only supports void as a return type.`,
      );
    }

    return { name, type };
  });
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
 * Parses a supported Native Autolink type, including nullable unions.
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

  const name = nonNullParts[0];

  if (
    name === undefined
    || (
      name !== 'void'
      && name !== 'string'
      && name !== 'number'
      && name !== 'boolean'
    )
  ) {
    throw unsupportedType(source, filename, context);
  }

  if (nullable && name === 'void') {
    throw unsupportedType(source, filename, context);
  }

  return { name, nullable };
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
    `Unsupported type "${source}" for ${context} in ${filename}. Native Autolink codegen v1 supports void, string, number, boolean, and unions with null.`,
  );
}

/**
 * Reads all native module specs declared under the package `types` directory.
 */
function readNativeModuleSpecs(root: string): NativeModuleSpec[] {
  const typesDir = path.join(root, 'types');

  if (!fs.existsSync(typesDir)) {
    return [];
  }

  const modules: NativeModuleSpec[] = [];

  for (const file of walkFiles(typesDir)) {
    if (!file.endsWith('.d.ts')) {
      continue;
    }

    const source = fs.readFileSync(file, 'utf8');
    modules.push(...parseNativeModules(source, path.relative(root, file)));
  }

  return modules;
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
 * Reads and normalizes the Native Autolink library manifest.
 */
function readManifest(root: string): LynxLibJson {
  const manifestPath = path.join(root, 'lynx.lib.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing lynx.lib.json in ${root}. Native Autolink codegen must run from a library package root.`,
    );
  }

  const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  const platforms = readObject(json, 'platforms', manifestPath);
  const android = readObject(platforms, 'android', manifestPath);
  const ios = readObject(platforms, 'ios', manifestPath);
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

  return {
    platforms: {
      android: {
        packageName,
        sourceDir: readOptionalString(
          android,
          'sourceDir',
          manifestPath,
          'platforms.android.sourceDir',
        ) ?? 'android',
      },
      ios: {
        sourceDir: readOptionalString(
          ios,
          'sourceDir',
          manifestPath,
          'platforms.ios.sourceDir',
        ) ?? 'ios',
      },
    },
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
 * Converts a parsed native module type to TypeScript syntax.
 */
function toTsType(type: NativeModuleType): string {
  const base = type.name === 'void' ? 'void' : type.name;
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

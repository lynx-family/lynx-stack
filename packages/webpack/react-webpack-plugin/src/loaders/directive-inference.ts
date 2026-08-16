// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type {
  DirectiveInferenceConfig,
  DirectiveInferenceDeclaration,
  DirectiveInferenceModule,
} from '@lynx-js/react/transform';

export const DIRECTIVE_INFERENCE_PROTOCOL_VERSION = 1;

interface DirectiveInferenceLoaderOptions {
  declarations?: DirectiveInferenceConfig | undefined;
}

interface PackageDirectiveInferenceManifest {
  protocolVersion: number;
  exports?: Record<string, DirectiveInferenceDeclaration> | undefined;
  modules?:
    | Record<
      string,
      {
        exports: Record<string, DirectiveInferenceDeclaration>;
      }
    >
    | undefined;
}

interface PackageJson {
  name?: string | undefined;
  version?: string | undefined;
  lynx?:
    | {
      directiveInference?:
        | string
        | PackageDirectiveInferenceManifest
        | undefined;
    }
    | undefined;
}

interface ParsedModuleDeclaration {
  end: number;
  request?: string;
}

interface ParsedStringLiteral {
  end: number;
  value?: string;
}

interface ParsedCharacter {
  end: number;
  value: string;
}

const IDENTIFIER_START_PATTERN = /^[$_\p{ID_Start}]$/u;
const IDENTIFIER_CONTINUE_PATTERN = /^[$\u200C\u200D\p{ID_Continue}]$/u;
const WHITESPACE_PATTERN = /^\s$/u;
const SIMPLE_STRING_ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\'': '\'',
  '\\': '\\',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

export function extractStaticModuleSources(source: string): string[] {
  const sources = new Set<string>();
  let braceDepth = 0;
  let bracketDepth = 0;
  let canStartRegularExpression = true;
  let index = 0;

  while (index < source.length) {
    if (index === 0 && source.startsWith('#!')) {
      index = skipLineComment(source, 2);
      continue;
    }
    const character = source[index]!;
    if (isWhitespace(character)) {
      index++;
      continue;
    }
    if (character === '/' && source[index + 1] === '/') {
      index = skipLineComment(source, index + 2);
      continue;
    }
    if (character === '/' && source[index + 1] === '*') {
      index = skipBlockComment(source, index + 2);
      continue;
    }
    if (character === '"' || character === '\'') {
      index = readStringLiteral(source, index)!.end;
      canStartRegularExpression = false;
      continue;
    }
    if (character === '`') {
      index = skipTemplateLiteral(source, index);
      canStartRegularExpression = false;
      continue;
    }
    if (character === '/' && canStartRegularExpression) {
      index = skipRegularExpression(source, index);
      canStartRegularExpression = false;
      continue;
    }
    const identifier = readIdentifier(source, index);
    if (identifier !== undefined) {
      if (braceDepth === 0 && bracketDepth === 0) {
        let declaration: ParsedModuleDeclaration | undefined;
        if (identifier.value === 'import') {
          declaration = parseImportDeclaration(source, identifier.end);
        } else if (identifier.value === 'export') {
          declaration = parseExportDeclaration(source, identifier.end);
        }
        if (declaration !== undefined) {
          if (
            declaration.request !== undefined
            && isPackageRequest(declaration.request)
          ) {
            sources.add(declaration.request);
          }
          index = declaration.end;
          canStartRegularExpression = true;
          continue;
        }
      }
      index = identifier.end;
      canStartRegularExpression = false;
      continue;
    }
    if (isDecimalDigit(character)) {
      index = skipNumber(source, index);
      canStartRegularExpression = false;
      continue;
    }

    index++;
    if (character === '{') {
      braceDepth++;
      canStartRegularExpression = true;
    } else if (character === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      canStartRegularExpression = false;
    } else if (character === '[') {
      bracketDepth++;
      canStartRegularExpression = true;
    } else if (character === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      canStartRegularExpression = false;
    } else if (character === ')' || character === '.') {
      canStartRegularExpression = false;
    } else {
      canStartRegularExpression = true;
    }
  }

  return [...sources].sort();
}

function parseImportDeclaration(
  source: string,
  start: number,
): ParsedModuleDeclaration | undefined {
  let index = skipTrivia(source, start);
  if (source[index] === '(' || source[index] === '.') {
    return undefined;
  }

  const sideEffectSource = readStringLiteral(source, index);
  if (sideEffectSource !== undefined) {
    return {
      end: sideEffectSource.end,
      ...(sideEffectSource.value === undefined
        ? {}
        : { request: sideEffectSource.value }),
    };
  }

  const typeKeyword = readIdentifier(source, index);
  if (typeKeyword?.value === 'type') {
    const afterType = skipTrivia(source, typeKeyword.end);
    const nextIdentifier = readIdentifier(source, afterType);
    if (
      source[afterType] === '{'
      || source[afterType] === '*'
      || (
        nextIdentifier !== undefined
        && nextIdentifier.value !== 'from'
      )
    ) {
      index = afterType;
    }
  }

  const defaultBinding = readIdentifier(source, index);
  if (defaultBinding === undefined) {
    const bindingsEnd = parseSecondaryImportBindings(source, index);
    if (bindingsEnd === undefined) {
      return undefined;
    }
    index = skipTrivia(source, bindingsEnd);
  } else {
    index = skipTrivia(source, defaultBinding.end);
    if (source[index] === ',') {
      index = skipTrivia(source, index + 1);
      const bindingsEnd = parseSecondaryImportBindings(source, index);
      if (bindingsEnd === undefined) {
        return undefined;
      }
      index = skipTrivia(source, bindingsEnd);
    }
  }

  const fromKeyword = readIdentifier(source, index);
  if (fromKeyword?.value !== 'from') {
    return undefined;
  }
  const moduleSource = readStringLiteral(
    source,
    skipTrivia(source, fromKeyword.end),
  );
  if (moduleSource === undefined) {
    return undefined;
  }
  return {
    end: moduleSource.end,
    ...(moduleSource.value === undefined
      ? {}
      : { request: moduleSource.value }),
  };
}

function parseSecondaryImportBindings(
  source: string,
  start: number,
): number | undefined {
  if (source[start] === '{') {
    return skipBalanced(source, start, '{', '}');
  }
  if (source[start] !== '*') {
    return undefined;
  }

  const asKeyword = readIdentifier(source, skipTrivia(source, start + 1));
  if (asKeyword?.value !== 'as') {
    return undefined;
  }
  return readIdentifier(source, skipTrivia(source, asKeyword.end))?.end;
}

function parseExportDeclaration(
  source: string,
  start: number,
): ParsedModuleDeclaration | undefined {
  let index = skipTrivia(source, start);
  const typeKeyword = readIdentifier(source, index);
  if (typeKeyword?.value === 'type') {
    const afterType = skipTrivia(source, typeKeyword.end);
    if (source[afterType] === '{' || source[afterType] === '*') {
      index = afterType;
    }
  }

  if (source[index] === '{') {
    index = skipTrivia(source, skipBalanced(source, index, '{', '}'));
  } else if (source[index] === '*') {
    index = skipTrivia(source, index + 1);
    const asKeyword = readIdentifier(source, index);
    if (asKeyword?.value === 'as') {
      const namespace = readIdentifier(
        source,
        skipTrivia(source, asKeyword.end),
      );
      if (namespace === undefined) {
        return undefined;
      }
      index = skipTrivia(source, namespace.end);
    }
  } else {
    return undefined;
  }

  const fromKeyword = readIdentifier(source, index);
  if (fromKeyword?.value !== 'from') {
    return undefined;
  }
  const moduleSource = readStringLiteral(
    source,
    skipTrivia(source, fromKeyword.end),
  );
  if (moduleSource === undefined) {
    return undefined;
  }
  return {
    end: moduleSource.end,
    ...(moduleSource.value === undefined
      ? {}
      : { request: moduleSource.value }),
  };
}

function skipTrivia(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    if (isWhitespace(source[index]!)) {
      index++;
    } else if (source[index] === '/' && source[index + 1] === '/') {
      index = skipLineComment(source, index + 2);
    } else if (source[index] === '/' && source[index + 1] === '*') {
      index = skipBlockComment(source, index + 2);
    } else {
      break;
    }
  }
  return index;
}

function skipLineComment(source: string, start: number): number {
  const newline = source.indexOf('\n', start);
  return newline === -1 ? source.length : newline + 1;
}

function skipBlockComment(source: string, start: number): number {
  const end = source.indexOf('*/', start);
  return end === -1 ? source.length : end + 2;
}

function readStringLiteral(
  source: string,
  start: number,
): ParsedStringLiteral | undefined {
  const quote = source[start];
  if (quote !== '"' && quote !== '\'') {
    return undefined;
  }

  let valid = true;
  let value = '';
  let index = start + 1;
  while (index < source.length) {
    const character = source[index]!;
    if (character === '\\') {
      const escape = readStringEscape(source, index);
      if (escape.value === undefined) {
        valid = false;
      } else {
        value += escape.value;
      }
      index = escape.end;
    } else if (character === quote) {
      return {
        end: index + 1,
        ...(valid ? { value } : {}),
      };
    } else if (
      character === '\n'
      || character === '\r'
      || character === '\u2028'
      || character === '\u2029'
    ) {
      return { end: index };
    } else {
      const codePoint = readCodePoint(source, index)!;
      value += codePoint.value;
      index = codePoint.end;
    }
  }
  return { end: source.length };
}

function readStringEscape(
  source: string,
  start: number,
): ParsedStringLiteral {
  const character = source[start + 1];
  if (character === undefined) {
    return { end: source.length };
  }
  if (character === '\n') {
    return { end: start + 2, value: '' };
  }
  if (character === '\r') {
    return {
      end: source[start + 2] === '\n' ? start + 3 : start + 2,
      value: '',
    };
  }
  if (character === '\u2028' || character === '\u2029') {
    return { end: start + 2, value: '' };
  }

  const simple = SIMPLE_STRING_ESCAPES[character];
  if (simple !== undefined) {
    return { end: start + 2, value: simple };
  }
  if (character === '0') {
    return isDecimalDigit(source[start + 2] ?? '')
      ? { end: start + 2 }
      : { end: start + 2, value: '\0' };
  }
  if (character === 'x') {
    const digits = source.slice(start + 2, start + 4);
    return digits.length === 2
        && [...digits].every(digit => isHexDigit(digit))
      ? {
        end: start + 4,
        value: String.fromCharCode(Number.parseInt(digits, 16)),
      }
      : { end: start + 2 };
  }
  if (character === 'u') {
    return readUnicodeEscape(source, start) ?? { end: start + 2 };
  }
  if (isDecimalDigit(character)) {
    return { end: start + 2 };
  }

  const codePoint = readCodePoint(source, start + 1)!;
  return { end: codePoint.end, value: codePoint.value };
}

function skipBalanced(
  source: string,
  start: number,
  open: string,
  close: string,
): number {
  let depth = 1;
  let index = start + 1;
  while (index < source.length && depth > 0) {
    const character = source[index]!;
    if (character === '"' || character === '\'') {
      index = readStringLiteral(source, index)!.end;
    } else if (character === '`') {
      index = skipTemplateLiteral(source, index);
    } else if (character === '/' && source[index + 1] === '/') {
      index = skipLineComment(source, index + 2);
    } else if (character === '/' && source[index + 1] === '*') {
      index = skipBlockComment(source, index + 2);
    } else {
      if (character === open) {
        depth++;
      } else if (character === close) {
        depth--;
      }
      index++;
    }
  }
  return index;
}

function skipTemplateLiteral(source: string, start: number): number {
  let index = start + 1;
  while (index < source.length) {
    const character = source[index]!;
    if (character === '\\') {
      index += 2;
    } else if (character === '`') {
      return index + 1;
    } else if (character === '$' && source[index + 1] === '{') {
      index = skipTemplateExpression(source, index + 2);
    } else {
      index++;
    }
  }
  return source.length;
}

function skipTemplateExpression(source: string, start: number): number {
  let depth = 1;
  let index = start;
  while (index < source.length && depth > 0) {
    const character = source[index]!;
    if (character === '"' || character === '\'') {
      index = readStringLiteral(source, index)!.end;
    } else if (character === '`') {
      index = skipTemplateLiteral(source, index);
    } else if (character === '/' && source[index + 1] === '/') {
      index = skipLineComment(source, index + 2);
    } else if (character === '/' && source[index + 1] === '*') {
      index = skipBlockComment(source, index + 2);
    } else {
      if (character === '{') {
        depth++;
      } else if (character === '}') {
        depth--;
      }
      index++;
    }
  }
  return index;
}

function skipRegularExpression(source: string, start: number): number {
  let inCharacterClass = false;
  let index = start + 1;
  while (index < source.length) {
    const character = source[index]!;
    if (character === '\\') {
      index += 2;
    } else if (character === '[') {
      inCharacterClass = true;
      index++;
    } else if (character === ']') {
      inCharacterClass = false;
      index++;
    } else if (character === '/' && !inCharacterClass) {
      index++;
      while (index < source.length) {
        const flag = readIdentifierCharacter(source, index, false);
        if (flag === undefined) {
          break;
        }
        index = flag.end;
      }
      return index;
    } else if (character === '\n' || character === '\r') {
      return index;
    } else {
      index++;
    }
  }
  return source.length;
}

function readIdentifier(
  source: string,
  start: number,
): { end: number; value: string } | undefined {
  const first = readIdentifierCharacter(source, start, true);
  if (first === undefined) {
    return undefined;
  }
  let end = first.end;
  let value = first.value;
  while (end < source.length) {
    const character = readIdentifierCharacter(source, end, false);
    if (character === undefined) {
      break;
    }
    value += character.value;
    end = character.end;
  }
  return { end, value };
}

function readIdentifierCharacter(
  source: string,
  start: number,
  first: boolean,
): ParsedCharacter | undefined {
  const character = source[start] === '\\'
    ? readUnicodeEscape(source, start)
    : readCodePoint(source, start);
  if (character === undefined) {
    return undefined;
  }
  const pattern = first
    ? IDENTIFIER_START_PATTERN
    : IDENTIFIER_CONTINUE_PATTERN;
  return pattern.test(character.value) ? character : undefined;
}

function readUnicodeEscape(
  source: string,
  start: number,
): ParsedCharacter | undefined {
  if (source[start] !== '\\' || source[start + 1] !== 'u') {
    return undefined;
  }
  if (source[start + 2] === '{') {
    let close = start + 3;
    while (close < source.length && isHexDigit(source[close]!)) {
      close++;
    }
    if (source[close] !== '}') {
      return undefined;
    }
    const digits = source.slice(start + 3, close);
    if (
      digits.length === 0
      || ![...digits].every(digit => isHexDigit(digit))
    ) {
      return undefined;
    }
    const codePoint = Number.parseInt(digits, 16);
    if (codePoint > 0x10_FFFF) {
      return undefined;
    }
    return {
      end: close + 1,
      value: String.fromCodePoint(codePoint),
    };
  }

  const digits = source.slice(start + 2, start + 6);
  if (
    digits.length !== 4
    || ![...digits].every(digit => isHexDigit(digit))
  ) {
    return undefined;
  }
  return {
    end: start + 6,
    value: String.fromCharCode(Number.parseInt(digits, 16)),
  };
}

function readCodePoint(
  source: string,
  start: number,
): ParsedCharacter | undefined {
  const codePoint = source.codePointAt(start);
  if (codePoint === undefined) {
    return undefined;
  }
  const value = String.fromCodePoint(codePoint);
  return { end: start + value.length, value };
}

function skipNumber(source: string, start: number): number {
  let end = start + 1;
  while (end < source.length) {
    if (source[end] === '.') {
      end++;
      continue;
    }
    const character = readIdentifierCharacter(source, end, false);
    if (character === undefined) {
      break;
    }
    end = character.end;
  }
  return end;
}

function isWhitespace(character: string): boolean {
  return WHITESPACE_PATTERN.test(character);
}

function isDecimalDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

function isHexDigit(character: string): boolean {
  return isDecimalDigit(character)
    || (character >= 'a' && character <= 'f')
    || (character >= 'A' && character <= 'F');
}

export function resolveDirectiveInferenceConfig(
  source: string,
  resourcePath: string,
  options: boolean | DirectiveInferenceLoaderOptions | undefined,
  addDependency?: (filename: string) => void,
): DirectiveInferenceConfig | undefined {
  if (options === false) {
    return undefined;
  }

  const modules = new Map<string, DirectiveInferenceModule>();
  for (const request of extractStaticModuleSources(source)) {
    const resolved = resolvePackageDeclaration(
      request,
      resourcePath,
      addDependency,
    );
    if (resolved !== undefined) {
      modules.set(resolved.source, resolved);
    }
  }

  const explicit = typeof options === 'object'
    ? options.declarations
    : undefined;
  if (explicit !== undefined) {
    assertDirectiveInferenceProtocolVersion(explicit.protocolVersion);
  }
  for (const declarationModule of explicit?.modules ?? []) {
    const current = modules.get(declarationModule.source);
    modules.set(
      declarationModule.source,
      current === undefined
        ? {
          ...declarationModule,
          exports: sortRecord(declarationModule.exports),
        }
        : {
          ...current,
          ...declarationModule,
          exports: sortRecord({
            ...current.exports,
            ...declarationModule.exports,
          }),
        },
    );
  }

  if (modules.size === 0) {
    return undefined;
  }

  return {
    protocolVersion: DIRECTIVE_INFERENCE_PROTOCOL_VERSION,
    modules: [...modules.values()].sort((left, right) =>
      left.source.localeCompare(right.source)
    ),
  };
}

function resolvePackageDeclaration(
  request: string,
  resourcePath: string,
  addDependency: ((filename: string) => void) | undefined,
): DirectiveInferenceModule | undefined {
  const packageName = packageNameFromRequest(request);
  const packageJsonPath = resolvePackageJson(packageName, resourcePath);
  if (packageJsonPath === undefined) {
    return undefined;
  }

  const packageJson = readJson<PackageJson>(packageJsonPath);
  const declaration = packageJson.lynx?.directiveInference;
  if (declaration === undefined) {
    return undefined;
  }
  addDependency?.(packageJsonPath);

  let manifest: PackageDirectiveInferenceManifest;
  let manifestPath = packageJsonPath;
  if (typeof declaration === 'string') {
    manifestPath = path.resolve(path.dirname(packageJsonPath), declaration);
    addDependency?.(manifestPath);
    manifest = readJson<PackageDirectiveInferenceManifest>(manifestPath);
  } else {
    manifest = declaration;
  }

  assertDirectiveInferenceProtocolVersion(
    manifest.protocolVersion,
    manifestPath,
  );

  const subpath = packageSubpath(request, packageName);
  const exports = manifest.modules?.[subpath]?.exports
    ?? (subpath === '.' ? manifest.exports : undefined);
  if (exports === undefined) {
    return undefined;
  }

  return {
    source: request,
    package: packageJson.name ?? packageName,
    ...(packageJson.version === undefined
      ? {}
      : { packageVersion: packageJson.version }),
    manifest: normalizeSlashes(
      `${path.relative(path.dirname(packageJsonPath), manifestPath)}${
        typeof declaration === 'string'
          ? ''
          : '#lynx.directiveInference'
      }`,
    ),
    exports: sortRecord(exports),
  };
}

function resolvePackageJson(
  packageName: string,
  resourcePath: string,
): string | undefined {
  const packageRequire = createRequire(resourcePath);
  try {
    return packageRequire.resolve(`${packageName}/package.json`);
  } catch {
    let resolvedEntry: string;
    try {
      resolvedEntry = packageRequire.resolve(packageName);
    } catch {
      return undefined;
    }

    let directory = path.dirname(resolvedEntry);
    while (true) {
      const candidate = path.join(directory, 'package.json');
      if (fs.existsSync(candidate)) {
        const packageJson = readJson<PackageJson>(candidate);
        if (packageJson.name === packageName) {
          return candidate;
        }
      }
      const parent = path.dirname(directory);
      if (parent === directory) {
        return undefined;
      }
      directory = parent;
    }
  }
}

function assertDirectiveInferenceProtocolVersion(
  protocolVersion: number,
  filename?: string,
): void {
  if (protocolVersion !== DIRECTIVE_INFERENCE_PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported directive-inference protocol version ${protocolVersion}${
        filename === undefined ? '' : ` in ${filename}`
      }; expected ${DIRECTIVE_INFERENCE_PROTOCOL_VERSION}.`,
    );
  }
}

function packageNameFromRequest(request: string): string {
  const segments = request.split('/');
  return request.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0]!;
}

function packageSubpath(request: string, packageName: string): string {
  const suffix = request.slice(packageName.length);
  return suffix === '' ? '.' : `.${suffix}`;
}

function isPackageRequest(request: string): boolean {
  return !request.startsWith('.')
    && !path.posix.isAbsolute(request)
    && !path.win32.isAbsolute(request)
    && !request.includes(':');
}

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(filename, 'utf8')) as T;
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeSlashes(filename: string): string {
  return filename.replaceAll(path.win32.sep, '/');
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { ParserPlugin } from '@babel/parser';
import { parse } from '@babel/parser';

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

const DIRECTIVE_INFERENCE_PARSER_PLUGINS = [
  'decorators-legacy',
  'decoratorAutoAccessors',
  'deferredImportEvaluation',
  'explicitResourceManagement',
  ['importAttributes', { deprecatedAssertSyntax: true }],
  'sourcePhaseImports',
  'typescript',
] satisfies ParserPlugin[];

export function extractStaticModuleSources(source: string): string[] {
  const program = parseModuleProgram(source);
  if (program === undefined) {
    return [];
  }

  const sources = new Set<string>();
  for (const statement of program.body) {
    if (
      statement.type !== 'ImportDeclaration'
      && statement.type !== 'ExportNamedDeclaration'
      && statement.type !== 'ExportAllDeclaration'
    ) {
      continue;
    }
    const moduleSource = statement.source;
    if (
      moduleSource?.type === 'StringLiteral'
      && isPackageRequest(moduleSource.value)
    ) {
      sources.add(moduleSource.value);
    }
  }

  return [...sources].sort();
}

function parseModuleProgram(source: string) {
  for (const jsx of [true, false]) {
    try {
      const plugins: ParserPlugin[] = [
        ...DIRECTIVE_INFERENCE_PARSER_PLUGINS,
      ];
      if (jsx) {
        plugins.push('jsx');
      }
      const parsed = parse(source, {
        allowUndeclaredExports: true,
        attachComment: false,
        errorRecovery: true,
        plugins,
        sourceType: 'unambiguous',
      });
      if (parsed.errors?.length === 0) {
        return parsed.program;
      }
    } catch {
      // Try plain TypeScript after TSX, then conservatively discover nothing.
    }
  }
  return undefined;
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

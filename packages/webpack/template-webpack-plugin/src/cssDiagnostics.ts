// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { SourceMapInput } from '@jridgewell/trace-mapping';
import type { Asset } from 'webpack';

import type * as CSS from '@lynx-js/css-serializer';

/**
 * A CSS diagnostic emitted by TASM during template encode.
 *
 * @public
 */
export interface TasmCSSDiagnostic {
  /**
   * The diagnostic category, such as `property`.
   */
  type?: string | undefined;
  /**
   * The unsupported CSS syntax name, when TASM reports one.
   */
  name?: string | undefined;
  /**
   * The generated CSS line reported by TASM.
   */
  line: number;
  /**
   * The generated CSS column reported by TASM.
   */
  column: number;
}

/**
 * A TASM CSS diagnostic with a formatted message and optional source map
 * location.
 *
 * @public
 */
export interface ResolvedTasmCSSDiagnostic extends TasmCSSDiagnostic {
  /**
   * The warning message suitable for webpack diagnostics.
   */
  message: string;
  /**
   * The original source file resolved from the CSS source map.
   */
  sourceFile?: string | undefined;
  /**
   * The original source line resolved from the CSS source map.
   */
  sourceLine?: number | undefined;
  /**
   * The original source column resolved from the CSS source map.
   */
  sourceColumn?: number | undefined;
}

/**
 * Options for {@link processTasmCSSDiagnostics}.
 *
 * @public
 */
export interface ProcessTasmCSSDiagnosticsOptions {
  /**
   * The raw `css_diagnostics` value returned by TASM.
   */
  cssDiagnostics: unknown;
  /**
   * CSS source map contents from the CSS chunks for the current template.
   */
  cssSourceMaps: string[];
  /**
   * The webpack compiler context used to resolve relative source paths.
   */
  context: string;
  /**
   * A mutable set used to skip diagnostics that were already emitted.
   */
  emittedWarnings?: Set<string> | undefined;
  /**
   * A file existence check used before attaching a mapped source location.
   */
  fileExists?: ((path: string) => boolean) | undefined;
}

/**
 * Parses, source-map-resolves, and deduplicates TASM CSS diagnostics.
 *
 * @public
 */
export function processTasmCSSDiagnostics({
  cssDiagnostics,
  cssSourceMaps,
  context,
  emittedWarnings,
  fileExists,
}: ProcessTasmCSSDiagnosticsOptions): ResolvedTasmCSSDiagnostic[] {
  const diagnostics = extractTasmCSSDiagnostics(cssDiagnostics);
  if (diagnostics.length === 0) {
    return [];
  }

  const resolveOptions: Parameters<typeof resolveTasmCSSDiagnostics>[0] = {
    cssDiagnostics: diagnostics,
    mainCSSSourceMaps: parseCSSSourceMaps(cssSourceMaps),
    context,
  };
  if (fileExists !== undefined) {
    resolveOptions.fileExists = fileExists;
  }

  return dedupeTasmCSSDiagnostics(
    resolveTasmCSSDiagnostics(resolveOptions),
    emittedWarnings,
  );
}

export function extractTasmCSSDiagnostics(value: unknown): TasmCSSDiagnostic[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(element => normalizeTasmCSSDiagnostic(element))
      .filter((diagnostic): diagnostic is TasmCSSDiagnostic => (
        diagnostic !== null
      ));
  } catch {
    return [];
  }
}

export function resolveTasmCSSDiagnostics({
  cssDiagnostics,
  mainCSSSourceMaps,
  context,
  fileExists = existsSync,
}: {
  cssDiagnostics: TasmCSSDiagnostic[];
  mainCSSSourceMaps: CSS.CSSSourceMap[];
  context: string;
  fileExists?: (path: string) => boolean;
}): ResolvedTasmCSSDiagnostic[] {
  if (mainCSSSourceMaps.length === 0) {
    return cssDiagnostics.map(diagnostic => ({
      ...diagnostic,
      message: formatTasmCSSDiagnosticMessage(diagnostic),
    }));
  }

  const traceMaps = mainCSSSourceMaps.map(sourceMap => ({
    sourceMap,
    traceMap: new TraceMap(sourceMap as SourceMapInput),
  }));

  return cssDiagnostics.map(diagnostic => {
    const message = formatTasmCSSDiagnosticMessage(diagnostic);

    for (const { sourceMap, traceMap } of traceMaps) {
      const mapped = originalPositionFor(traceMap, {
        line: diagnostic.line,
        column: Math.max(diagnostic.column - 1, 0),
      });

      if (
        mapped.source === null
        || mapped.line === null
        || mapped.column === null
      ) {
        continue;
      }

      const sourceFile = normalizeTasmSourcePath(
        mapped.source,
        sourceMap,
        context,
      );
      if (!sourceFile || !fileExists(sourceFile)) {
        continue;
      }

      return {
        ...diagnostic,
        message,
        sourceFile,
        sourceLine: mapped.line,
        sourceColumn: mapped.column + 1,
      };
    }

    return {
      ...diagnostic,
      message,
    };
  });
}

export function dedupeTasmCSSDiagnostics<T extends ResolvedTasmCSSDiagnostic>(
  diagnostics: T[],
  seen: Set<string> = new Set<string>(),
): T[] {
  return diagnostics.filter(diagnostic => {
    const line = diagnostic.sourceLine ?? diagnostic.line;
    const column = diagnostic.sourceColumn ?? diagnostic.column;
    const key = [
      diagnostic.message,
      diagnostic.sourceFile ?? '',
      line,
      column,
    ].join('\0');

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function collectCSSSourceMapContents(
  cssChunks: Asset[] | undefined,
): string[] {
  const sourceMaps: string[] = [];

  if (!cssChunks || cssChunks.length === 0) {
    return sourceMaps;
  }

  cssChunks.forEach((cssChunk) => {
    const sourceMap = normalizeCSSSourceMap(cssChunk.source.map?.());
    if (sourceMap) {
      sourceMaps.push(JSON.stringify(sourceMap));
    }
  });

  return Array.from(new Set(sourceMaps));
}

function parseCSSSourceMaps(cssSourceMaps: string[]): CSS.CSSSourceMap[] {
  return cssSourceMaps.reduce<CSS.CSSSourceMap[]>((parsed, cssSourceMap) => {
    if (cssSourceMap.trim() === '') {
      return parsed;
    }

    try {
      const sourceMap = JSON.parse(cssSourceMap) as unknown;
      if (isCSSSourceMap(sourceMap)) {
        parsed.push(sourceMap);
      }
    } catch {
      // Ignore invalid source map payloads.
    }

    return parsed;
  }, []);
}

function normalizeCSSSourceMap(
  sourceMap: ReturnType<Asset['source']['map']> | undefined,
): CSS.CSSSourceMap | undefined {
  if (!sourceMap || Array.isArray(sourceMap)) {
    return undefined;
  }

  return sourceMap;
}

function isCSSSourceMap(value: unknown): value is CSS.CSSSourceMap {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value['version'] === 'number'
    && typeof value['mappings'] === 'string'
    && Array.isArray(value['sources'])
  );
}

function normalizeTasmCSSDiagnostic(value: unknown): TasmCSSDiagnostic | null {
  if (!isRecord(value)) {
    return null;
  }

  const line = value['line'];
  const column = value['column'];
  if (typeof line !== 'number' || typeof column !== 'number') {
    return null;
  }

  return {
    type: value['type'] as string | undefined,
    name: value['name'] as string | undefined,
    line,
    column,
  };
}

function normalizeTasmSourcePath(
  source: string,
  sourceMap: CSS.CSSSourceMap,
  context: string,
): string | undefined {
  if (source.startsWith('file://')) {
    return fileURLToPath(source);
  }

  if (source.startsWith('webpack:')) {
    // webpack sources look like:
    //   webpack:///./src/App.css        (no namespace)
    //   webpack://<namespace>/./src/App.css
    const withoutScheme = source.replace(/^webpack:(?:\/\/[^/]*\/|\/)/, '');
    const normalized = withoutScheme
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
    return resolvePath(context, normalized);
  }

  if (source.startsWith('/')) {
    return source;
  }

  if (sourceMap.sourceRoot) {
    return resolvePath(sourceMap.sourceRoot, source);
  }

  return resolvePath(context, source);
}

function formatTasmCSSDiagnosticMessage(
  diagnostic: TasmCSSDiagnostic,
): string {
  const type = diagnostic.type ?? 'css syntax';
  if (diagnostic.name) {
    return `Unsupported ${type} "${diagnostic.name}" was removed during template encode.`;
  }

  return `Unsupported ${type} was removed during template encode.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

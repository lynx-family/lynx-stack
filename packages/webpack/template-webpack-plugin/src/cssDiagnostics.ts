// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { SourceMapInput } from '@jridgewell/trace-mapping';

import type * as CSS from '@lynx-js/css-serializer';

export interface TasmCSSDiagnostic {
  type?: string | undefined;
  name?: string | undefined;
  line: number;
  column: number;
}

export interface ResolvedTasmCSSDiagnostic extends TasmCSSDiagnostic {
  message: string;
  sourceFile?: string | undefined;
  sourceLine?: number | undefined;
  sourceColumn?: number | undefined;
}

export function extractTasmCSSDiagnostics(value: unknown): TasmCSSDiagnostic[] {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown as TasmCSSDiagnostic[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((element) => normalizeTasmCSSDiagnostic(element))
      .filter((diagnostic): diagnostic is TasmCSSDiagnostic => (
        diagnostic !== null
      ));
  } catch {
    return [];
  }
}

export function resolveTasmCSSDiagnostics({
  cssDiagnostics,
  mainCSSSourceMap,
  context,
  fileExists = existsSync,
}: {
  cssDiagnostics: TasmCSSDiagnostic[];
  mainCSSSourceMap: CSS.CSSSourceMap | undefined;
  context: string;
  fileExists?: (path: string) => boolean;
}): ResolvedTasmCSSDiagnostic[] {
  if (!mainCSSSourceMap) {
    return cssDiagnostics.map(diagnostic => ({
      ...diagnostic,
      message: formatTasmCSSDiagnosticMessage(diagnostic),
    }));
  }

  const traceMap = new TraceMap(mainCSSSourceMap as SourceMapInput);

  return cssDiagnostics.map(diagnostic => {
    const mapped = originalPositionFor(traceMap, {
      line: diagnostic.line,
      column: Math.max(diagnostic.column - 1, 0),
    });

    const message = formatTasmCSSDiagnosticMessage(diagnostic);
    if (
      mapped.source === null
      || mapped.line === null
      || mapped.column === null
    ) {
      return {
        ...diagnostic,
        message,
      };
    }

    const sourceFile = normalizeTasmSourcePath(
      mapped.source,
      mainCSSSourceMap,
      context,
    );
    if (!sourceFile || !fileExists(sourceFile)) {
      return {
        ...diagnostic,
        message,
      };
    }

    return {
      ...diagnostic,
      message,
      sourceFile,
      sourceLine: mapped.line,
      sourceColumn: mapped.column + 1,
    };
  });
}

export function dedupeTasmCSSDiagnostics<T extends ResolvedTasmCSSDiagnostic>(
  diagnostics: T[],
  seen: Set<string> = new Set(),
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

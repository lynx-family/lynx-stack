/**
 * A TS reimplementation of biz_sourcemap's reversal, for tests. It reads the
 * build's own `debug-metadata.json` artifacts (no network) and reverses frames
 * with the `source-map` package, mirroring the backend's column convention:
 *
 *   engine column is 1-based  ->  subtract 1 for the source map's 0-based lookup
 *   resolved column is 0-based ->  add 1 back on output (report 1-based)
 *
 * No per-engine compensation — a faithful lookup, same as the backend.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { SourceMapConsumer } from 'source-map';
import type { RawSourceMap } from 'source-map';

export interface MapEntry {
  kind: string;
  /** Bundle path with content hash, e.g. `.rspeedy/LazyComponent/background.<hash>.js`. */
  path: string;
  /** Absolute path to the emitted bundle .js, for locating tokens in generated code. */
  jsFile: string;
  map: RawSourceMap;
}

/** One reversal step, matching biz_sourcemap's RemapStep JSON. */
export interface Step {
  kind: string;
  filename: string;
  lineno: number;
  colno: number;
  /** present only when the mapping carries an original name (backend omitempty). */
  function_name?: string;
  context_line?: string;
  pre_context: string[];
  post_context: string[];
}

const CONTEXT_LINES = 5;
/**
 * Minified bundles are one giant line, so a bytecode step's context would be
 * tens of KB. The backend returns it whole; for a readable snapshot we clip each
 * context line (the head is enough to spot a regression). Test-only.
 */
const MAX_CONTEXT_LEN = 200;

function clip(line: string): string {
  return line.length > MAX_CONTEXT_LEN
    ? `${line.slice(0, MAX_CONTEXT_LEN)} [+${
      line.length - MAX_CONTEXT_LEN
    } chars]`
    : line;
}

/** Normalize a source-map `source` to a portable, backend-like path. */
function normalizeSource(source: string): string {
  const i = source.indexOf('/src/');
  if (i >= 0) return source.slice(i + 1); // -> "src/..."
  return source.replace('webpack:///./', 'webpack:///');
}

/** Slice context lines (matching the backend's ±5), clipping over-long lines. */
function sliceContext(
  lines: string[],
  line1: number,
): Pick<Step, 'context_line' | 'pre_context' | 'post_context'> {
  const cl = lines[line1 - 1];
  return {
    context_line: cl == null ? undefined : clip(cl),
    pre_context: lines.slice(Math.max(0, line1 - 1 - CONTEXT_LINES), line1 - 1)
      .map((l) => clip(l)),
    post_context: lines.slice(line1, line1 + CONTEXT_LINES).map((l) => clip(l)),
  };
}

/**
 * Reverse a generated position through a source map into a full step (with
 * context lines), the same shape biz_sourcemap returns. `genCol0` is 0-based.
 */
export async function resolveStep(
  map: RawSourceMap,
  genLine: number,
  genCol0: number,
): Promise<Step | null> {
  return SourceMapConsumer.with(map, null, (consumer) => {
    const pos = consumer.originalPositionFor({
      line: genLine,
      column: Math.max(0, genCol0),
    });
    if (!pos.source || pos.line == null) return null;
    const content = consumer.sourceContentFor(pos.source, true);
    const lines = content ? content.split('\n') : [];
    const step: Step = {
      kind: 'source-map',
      filename: normalizeSource(pos.source),
      lineno: pos.line,
      colno: (pos.column ?? 0) + 1,
      ...sliceContext(lines, pos.line),
    };
    if (pos.name) step.function_name = pos.name;
    return step;
  });
}

/**
 * Build a step from already-split source lines (for the mainThread bytecode step and
 * its source-map step). `functionName`, when set, mirrors the backend's
 * `function_name` (only the source-map step carries one).
 */
export function stepFromLines(
  kind: string,
  filename: string,
  line1: number,
  col1: number,
  lines: string[],
  functionName?: string,
): Step {
  const step: Step = {
    kind,
    filename,
    lineno: line1,
    colno: col1,
    ...sliceContext(lines, line1),
  };
  if (functionName) step.function_name = functionName;
  return step;
}

function walk(dir: string, cb: (file: string) => void): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, cb);
    else cb(p);
  }
}

/**
 * Index every artifact's source map by its release key (= the per-bundle
 * content hash a frame's `release` carries, minus the `debugmetadata:` prefix),
 * scanning all `debug-metadata.json` under the given dist dirs.
 */
export function buildMapIndex(distDirs: string[]): Map<string, MapEntry> {
  const index = new Map<string, MapEntry>();
  for (const dir of distDirs) {
    if (!existsSync(dir)) continue;
    walk(dir, (file) => {
      if (path.basename(file) !== 'debug-metadata.json') return;
      const meta = JSON.parse(readFileSync(file, 'utf8')) as {
        artifacts?: {
          kind: string;
          path?: string;
          debugSources?: {
            kind: string;
            key?: string;
            map?: string | RawSourceMap;
          }[];
        }[];
      };
      for (const artifact of meta.artifacts ?? []) {
        for (const ds of artifact.debugSources ?? []) {
          if (ds.kind === 'source-map' && ds.key && ds.map) {
            const map = typeof ds.map === 'string'
              ? JSON.parse(ds.map) as RawSourceMap
              : ds.map;
            index.set(ds.key, {
              kind: artifact.kind,
              path: artifact.path ?? '',
              jsFile: path.join(dir, artifact.path ?? ''),
              map,
            });
          }
        }
      }
    });
  }
  return index;
}

/**
 * Main-thread (mainThread / lepusNG) reversal + inference, mirroring biz_sourcemap's
 * 2-step path. The main-thread engine is always PrimJS-family, so there is one
 * result per case (no v8/jsc/quickjs split).
 *
 * A mainThread frame is `fn:function_id:pc`. Reversal:
 *   function_info[function_id].line_col[pc - 1] -> {line,col} in main-thread.js
 *   -> main-thread source-map -> business source.
 *
 * Inference (no device): find the throw's source line (by a message marker in
 * the main-thread source-map's sourcesContent), then invert — scan every
 * function's `line_col`, source-map each entry, and collect the (fid, pc) that
 * land on that line. The engine reports one specific pc among them; we surface
 * the function id, the pc range, and the (identical) resolved position. Verify
 * the exact fid/pc against a device.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { SourceMapConsumer } from 'source-map';
import type { RawSourceMap } from 'source-map';

import { stepFromLines } from './remap-lib.js';
import type { Step } from './remap-lib.js';

interface LineCol {
  line: number;
  column: number;
}
interface FunctionInfo {
  function_id: number;
  function_name: string;
  line_col: LineCol[];
}
export interface MainThreadEntry {
  release: string;
  /** main-thread bundle path, e.g. `.rspeedy/LazyComponent/main-thread.js`. */
  path: string;
  functions: FunctionInfo[];
  /** generated main-thread.js source, for the bytecode step's context. */
  functionSource: string;
  map: RawSourceMap;
}

export interface MainThreadResult {
  release: string;
  path: string;
  functionId: number;
  /** pc the engine reports — the last bytecode on the throw line (device: 21:38). */
  pc: number;
  /** ordered reversal chain: bytecode-debug-info -> source-map (matches biz_sourcemap). */
  steps: Step[];
}

function walk(dir: string, cb: (file: string) => void): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, cb);
    else cb(p);
  }
}

/** Index every main-thread artifact's (release -> bytecode functions + map). */
export function buildMainThreadIndex(
  distDirs: string[],
): Map<string, MainThreadEntry> {
  const index = new Map<string, MainThreadEntry>();
  for (const dir of distDirs) {
    if (!existsSync(dir)) continue;
    walk(dir, (file) => {
      if (path.basename(file) !== 'debug-metadata.json') return;
      const meta = JSON.parse(readFileSync(file, 'utf8')) as {
        artifacts?: {
          kind: string;
          debugSources?: Record<string, unknown>[];
        }[];
      };
      for (
        const artifact of meta.artifacts as {
          kind: string;
          path?: string;
          debugSources?: Record<string, unknown>[];
        }[] ?? []
      ) {
        if (artifact.kind !== 'main-thread') continue;
        const smds = artifact.debugSources?.find((d) =>
          d.kind === 'source-map'
        );
        const bcds = artifact.debugSources?.find((d) =>
          d.kind === 'bytecode-debug-info'
        );
        if (!smds?.key || !smds.map || !bcds?.debugInfo) continue;
        const map = (typeof smds.map === 'string'
          ? JSON.parse(smds.map)
          : smds.map) as RawSourceMap;
        const dbg = (typeof bcds.debugInfo === 'string'
          ? JSON.parse(bcds.debugInfo) as unknown
          : bcds.debugInfo) as {
            lepusNG_debug_info?: {
              function_info?: FunctionInfo[];
              function_source?: string;
            };
          };
        const lng = dbg.lepusNG_debug_info;
        index.set(smds.key as string, {
          release: smds.key as string,
          path: artifact.path ?? '',
          functions: lng?.function_info ?? [],
          functionSource: lng?.function_source ?? '',
          map,
        });
      }
    });
  }
  return index;
}

/** Infer the mainThread frame for a throw identified by a source-message marker. */
export async function inferMainThread(
  marker: string,
  index: Map<string, MainThreadEntry>,
): Promise<MainThreadResult> {
  for (const [release, entry] of index) {
    const srcIdx = (entry.map.sourcesContent ?? []).findIndex((c) =>
      c?.includes(marker)
    );
    if (srcIdx < 0) continue;
    const content = entry.map.sourcesContent![srcIdx];
    const file = path.basename(entry.map.sources[srcIdx]);
    const throwLine =
      content.slice(0, content.indexOf(marker)).split('\n').length;
    const genLines = entry.functionSource.split('\n');
    return SourceMapConsumer.with(entry.map, null, (consumer) => {
      let fid = -1, pc = -1, lc: LineCol | null = null;
      for (const fn of entry.functions) {
        for (let i = 0; i < fn.line_col.length; i++) {
          const cand = fn.line_col[i];
          const pos = consumer.originalPositionFor({
            line: cand.line,
            column: cand.column,
          });
          // The engine reports the LAST bytecode on the throw line (device:
          // function_id 21, pc 38). Scan every function_info entry and keep the
          // globally highest pc, so the pick is deterministic rather than
          // JSON-order-dependent when several functions map to the same line.
          if (
            pos.source && path.basename(pos.source) === file
            && pos.line === throwLine
            && i + 1 > pc
          ) {
            fid = fn.function_id;
            pc = i + 1;
            lc = cand;
          }
        }
      }
      if (fid < 0 || !lc) {
        throw new Error(
          `no mainThread pc maps to ${file}:${throwLine} for ${marker}`,
        );
      }
      // step 1: bytecode-debug-info -> position in generated main-thread.js
      const step1 = stepFromLines(
        'bytecode-debug-info',
        'main-thread.js',
        lc.line,
        lc.column + 1,
        genLines,
      );
      // step 2: that generated position -> business source
      const pos = consumer.originalPositionFor({
        line: lc.line,
        column: lc.column,
      });
      const srcContent = pos.source
        ? consumer.sourceContentFor(pos.source, true)
        : null;
      const srcLines = srcContent ? srcContent.split('\n') : [];
      const step2 = stepFromLines(
        'source-map',
        pos.source
          ? (pos.source.includes('/src/')
            ? pos.source.slice(pos.source.indexOf('/src/') + 1)
            : pos.source)
          : file,
        pos.line ?? 0,
        (pos.column ?? 0) + 1,
        srcLines,
        pos.name ?? undefined,
      );
      return {
        release,
        path: entry.path,
        functionId: fid,
        pc,
        steps: [step1, step2],
      };
    });
  }
  throw new Error(`marker not found in any main-thread bundle: ${marker}`);
}

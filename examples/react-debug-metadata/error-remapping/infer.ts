/**
 * Infer the generated stack frame an engine reports for a background (JS) crash,
 * by locating the failing identifier directly in the CURRENT build's bundle (no
 * source-map segment math). Engines point at the crash differently depending on
 * its class — a CALL site, a property READ, or an undefined-GLOBAL reference.
 *
 * Calibrated against Lynx devices (L1/C3 throw, C1 method, C2 ReferenceError,
 * L4 property):
 *
 *   call  (throw Error(...), obj.method()):
 *     v8      -> callee identifier START   (matches Node/V8)
 *     jsc     -> callee identifier END     (the `(`)
 *     primjs -> call expression END       (after `)`, the call's return address)
 *   read  (property access, e.g. (void 0).x):
 *     v8/jsc  -> identifier END
 *     primjs -> identifier START          (device L4: the `x` itself)
 *   global (undefined GLOBAL variable, ReferenceError):
 *     v8      -> identifier END            (device: `notDefinedVariable+1` -> `+`;
 *                Lynx V8 differs from Node/V8, which reports START)
 *     jsc     -> identifier END            (provisional)
 *     primjs -> MODULE TOP                (device C2: 85608 = the outermost IIFE
 *                call `(` at the bundle's end. It has NO source-map mapping, so it
 *                reverses to null — PrimJS blames the module entry, not the
 *                variable, which actually sits at 84177. Real engine behaviour.)
 *
 * So a case needs a `token` (the failing identifier) plus its `err` class; the
 * column is the token's start / end, the call expr end, or the module top.
 */
import { existsSync, readFileSync } from 'node:fs';

import type { MapEntry } from './remap-lib.js';

export type Engine = 'v8' | 'jsc' | 'primjs';
export const ENGINES: Engine[] = ['v8', 'jsc', 'primjs'];

/** Crash class — drives where each engine points (see file header for devices). */
export type ErrorKind = 'call' | 'read' | 'global';

type Anchor = 'start' | 'end' | 'call-end' | 'module-top';

function anchor(engine: Engine, err: ErrorKind): Anchor {
  if (engine === 'v8') return err === 'call' ? 'start' : 'end';
  if (engine === 'primjs') {
    if (err === 'call') return 'call-end';
    if (err === 'global') return 'module-top';
    return 'start'; // property read
  }
  return 'end'; // jsc everywhere
}

/**
 * From the call's `(` at `openIdx0` (0-based), return the 0-based column just
 * after the matching `)` — PrimJS reports a call site at the call expression's
 * exclusive end (its return address), not the callee token. String literals
 * (whose parens must not count) are skipped.
 */
function callExprEnd(line: string, openIdx0: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIdx0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === '\'' || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) return i + 1;
  }
  throw new Error(`unbalanced call parens at ${openIdx0}`);
}

export interface BgInfer {
  lineno: number;
  /** 1-based generated column the engine reports. */
  colno: number;
  release: string;
}

/**
 * Locate `find` in a background bundle and return the frame `engine` reports for
 * the failing identifier `token` (a substring of `find`) of class `err`, tagged
 * with that bundle's release.
 */
export function inferBgFrame(
  find: string,
  token: string,
  err: ErrorKind,
  engine: Engine,
  index: Map<string, MapEntry>,
): BgInfer {
  const ti = find.indexOf(token);
  if (ti < 0) throw new Error(`token (${token}) not in find (${find})`);
  for (const [release, entry] of index) {
    if (entry.kind !== 'background') continue;
    let text: string;
    try {
      text = readFileSync(entry.jsFile, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const idx = line.indexOf(find);
      if (idx < 0) continue;
      const start0 = idx + ti; // identifier start (0-based)
      const end0 = start0 + token.length; // identifier exclusive end (0-based); for a call, the `(`
      const a = anchor(engine, err);
      let col0 = end0;
      if (a === 'start') {
        col0 = start0;
      } else if (a === 'call-end') {
        col0 = callExprEnd(line, end0);
      } else if (a === 'module-top') {
        // outermost IIFE call — PrimJS's report for an undefined global
        col0 = line.lastIndexOf('(');
      }
      return { lineno: li + 1, colno: col0 + 1, release };
    }
  }
  const scanned = [...index.entries()].map(([release, entry]) =>
    `  ${entry.kind} ${release.slice(0, 12)}… ${entry.jsFile} (exists: ${
      existsSync(entry.jsFile)
    })`
  );
  throw new Error(
    `find not located in any background bundle: ${find}\nscanned index:\n${
      scanned.join('\n')
    }`,
  );
}

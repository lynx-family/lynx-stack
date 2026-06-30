/**
 * Every demo crash button, grouped by page section, top-to-bottom order.
 * `name` matches the on-page button text verbatim.
 *
 * - kind 'bg'    : background (JS) frame. `find` is a substring unique in the
 *   generated bundle; `token` is the failing identifier within it; `err` is the
 *   crash class — 'call' (throw Error(...) / obj.method()), 'read' (property
 *   access like (void 0).x), or 'global' (undefined global variable). The
 *   per-engine column derives from token + err (see infer.ts).
 * - kind 'main-thread' : main-thread frame. `marker` is the throw's unique message;
 *   the (function_id, pc) is inverted out of the bytecode-debug-info. PrimJS
 *   bytecode is engine-independent, so a mainThread case reverses the same for every
 *   engine (kept in all three files for page-order parity).
 *
 * MainThread pcs are inferred without a device sample yet — verify those against
 * a device. (The PrimJS column anchors are device-calibrated; see infer.ts.)
 */
import type { ErrorKind } from './infer.js';

export type Case =
  | { name: string; kind: 'bg'; err: ErrorKind; find: string; token: string }
  | { name: string; kind: 'main-thread'; marker: string };

export interface Section {
  name: string;
  cases: Case[];
}

export const sections: Section[] = [
  {
    name: '1 · LazyComponent (dynamic)',
    cases: [
      {
        name: 'L1. nested deep stack (dynamic, background)',
        kind: 'bg',
        err: 'call',
        find: 'Error("boom from deep nested call (LazyComponent, background)',
        token: 'Error',
      },
      {
        name: 'L2. TypeError (dynamic, background)',
        kind: 'bg',
        err: 'call',
        find: '.gone(',
        token: 'gone',
      },
      {
        name: 'L3. main-thread error (dynamic)',
        kind: 'main-thread',
        marker: 'boom from LazyComponent main-thread',
      },
      {
        name: 'L4. read .x of undefined (dynamic, background)',
        kind: 'bg',
        err: 'read',
        find: '(void 0).x',
        token: 'x',
      },
    ],
  },
  {
    name: '2 · Host (App.tsx)',
    cases: [
      {
        name: 'H1. throw new Error (host, background)',
        kind: 'bg',
        err: 'call',
        find: 'Error("explicit throw new Error (App.tsx host, background)',
        token: 'Error',
      },
      {
        name: 'H2. TypeError (host, background)',
        kind: 'bg',
        err: 'call',
        find: '.missing(',
        token: 'missing',
      },
      {
        name: 'H3. nested deep stack (host, background)',
        kind: 'bg',
        err: 'call',
        find: 'Error("boom from App.tsx deep nested call (host, background)',
        token: 'Error',
      },
      {
        name: 'H4. main-thread error (host)',
        kind: 'main-thread',
        marker: 'boom from App.tsx main-thread (host)',
      },
    ],
  },
  {
    name: '3 · CrashDemo (host)',
    cases: [
      {
        name: '1. TypeError (call undefined, background)',
        kind: 'bg',
        err: 'call',
        find: '.notAFunction(',
        token: 'notAFunction',
      },
      // 'global', not 'read': PrimJS reports an undefined-GLOBAL ReferenceError
      // at the module top (the outermost IIFE call, no source-map mapping ->
      // reverses to null), not the variable site. v8/jsc report the variable.
      {
        name: '2. ReferenceError (background)',
        kind: 'bg',
        err: 'global',
        find: 'notDefinedVariable+1',
        token: 'notDefinedVariable',
      },
      {
        name: '3. throw new Error (background)',
        kind: 'bg',
        err: 'call',
        find: 'Error("explicit throw new Error (background)',
        token: 'Error',
      },
      {
        name: '4. nested deep stack (background)',
        kind: 'bg',
        err: 'call',
        find: 'Error("boom from deep nested call (background)',
        token: 'Error',
      },
      // page buttons 5 (async throw after await) and 6 (throw inside lazy chunk)
      // are omitted: they don't red-screen on a real device, so there's no frame
      // to reverse.
      {
        name: '7. main-thread error',
        kind: 'main-thread',
        marker: 'boom from main-thread',
      },
    ],
  },
];

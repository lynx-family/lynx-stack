/**
 * Full-flow remap regression, parameterised by background engine (design C:
 * inference). For each demo crash button it reverses the WHOLE flow against the
 * CURRENT build's `debug-metadata.json` and snapshots a backend-shaped frame
 * ({code, release, raw, steps[]}, each step mirroring biz_sourcemap's RemapStep).
 *
 *   - background (JS) frames: infer the generated column `engine` reports for the
 *     failing identifier, then reverse with the same column convention as the
 *     backend (colno-1 in, +1 out — engine-agnostic, faithful to the source map).
 *   - main-thread frames: invert the bytecode-debug-info to (function_id,
 *     pc), then 2-step reverse. PrimJS bytecode is engine-independent, so a mainThread
 *     case reverses identically for every engine; it's kept in all three files so
 *     each one covers the whole page in button order.
 *
 * Each engine gets its own test file (remap.<engine>.test.ts) and therefore its
 * own snapshot file. Everything is derived from the current build, so a
 * build/plugin/reversal regression shows up as a snapshot diff, and editing the
 * demo never needs device re-recording (just `pnpm test:update`). Verify the
 * inferred numbers against a real device.
 *
 * Prereq: `debug-metadata.json` is a build intermediate (normally cleaned), so
 * build with DEBUG to keep it: `DEBUG='rspeedy,rsbuild' pnpm build`
 * (= `pnpm test:build`).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from '@rstest/core';

import { sections } from './cases.js';
import { computeFrame } from './frames.js';
import type { ComputedFrame } from './frames.js';
import type { Engine } from './infer.js';
import { buildMainThreadIndex } from './main-thread.js';
import type { MainThreadEntry } from './main-thread.js';
import { buildMapIndex } from './remap-lib.js';
import type { MapEntry } from './remap-lib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const example = path.resolve(here, '..');
const distDirs = [
  path.join(example, 'dist-producer'),
  path.join(example, 'dist-consumer'),
];

/**
 * Strip a build-environment-specific token to a stable placeholder: `release`
 * is a content sha1 of the source map (whose `sources` carry absolute paths, so
 * it differs per checkout location), chunk filenames carry a content hash, and
 * the producer's `sourceMappingURL` embeds the local dev-server host:port.
 */
function stripEnv(s: string): string {
  return s
    .replace(/[0-9a-f]{40}/g, '<release>')
    .replace(/\.[0-9a-f]{8}\.js/g, '.<hash>.js')
    .replace(/http:\/\/[\d.]+:\d+/g, 'http://<host>');
}

/**
 * Make a frame portable across machines / CI. The source-side line and context
 * (the reverse-mapping under test) are kept verbatim; build-environment-specific
 * bits (release / chunk hashes, the bundles' generated locations and the
 * bytecode-debug-info coordinates) are normalized so re-minifying the bundle
 * after a deps bump or on another platform does not churn the snapshot.
 */
function portable(frame: ComputedFrame): ComputedFrame {
  const raw = stripEnv(frame.raw);
  return {
    code: frame.code,
    release: stripEnv(frame.release),
    // `raw` is the engine's frame in the MINIFIED bundle; infer.ts derives its
    // column by locating the token in the current build's output, so it shifts
    // with minify (deps / platform). Normalize that generated location. The
    // bytecode-debug-info step likewise points into the minified main-thread.js,
    // so its generated coordinates and context are normalized too.
    raw: raw.replace(/:\d+:\d+(\)?)$/, ':<loc>$1'),
    steps: frame.steps.map((s) =>
      s.kind === 'bytecode-debug-info'
        ? {
          ...s,
          lineno: -1,
          colno: -1,
          context_line: '<generated>',
          pre_context: [],
          post_context: [],
        }
        // The source-map step is the actual reverse-mapping result. Keep its
        // source line AND column verbatim: each build's own source-map maps the
        // token back to the same source position regardless of minify (the
        // engine anchor floors to the token's mapping segment), so asserting the
        // real reversed column catches reversal regressions instead of hiding
        // them. Only env-specific tokens in the context lines are stripped.
        : {
          ...s,
          context_line: s.context_line === undefined
            ? undefined
            : stripEnv(s.context_line),
          pre_context: s.pre_context.map((l) => stripEnv(l)),
          post_context: s.post_context.map((l) => stripEnv(l)),
        }
    ),
  };
}

export function runEngine(engine: Engine): void {
  let bg: Map<string, MapEntry>;
  let mainThread: Map<string, MainThreadEntry>;
  beforeAll(() => {
    bg = buildMapIndex(distDirs);
    mainThread = buildMainThreadIndex(distDirs);
  });

  it('build products are present (run `pnpm test:build` first)', () => {
    expect([...bg.values()].some((e) => e.kind === 'background')).toBe(true);
  });

  for (const section of sections) {
    describe(section.name, () => {
      for (const testCase of section.cases) {
        // main-thread frames are engine-independent (PrimJS bytecode) but kept in
        // every engine's file so each covers the page in button order.
        it(testCase.name, async () => {
          expect(portable(await computeFrame(testCase, engine, bg, mainThread)))
            .toMatchSnapshot();
        });
      }
    });
  }
}

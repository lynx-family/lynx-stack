/**
 * Compute one backend-shaped frame ({code, release, raw, steps}) for a case +
 * engine from the CURRENT build — the single source of truth the snapshot tests
 * (runEngine.ts) assert against.
 */
import type { Case } from './cases.js';
import { inferBgFrame } from './infer.js';
import type { Engine } from './infer.js';
import { inferMainThread } from './main-thread.js';
import type { MainThreadEntry } from './main-thread.js';
import { resolveStep } from './remap-lib.js';
import type { MapEntry, Step } from './remap-lib.js';

export interface ComputedFrame {
  code: number;
  release: string;
  /** generated frame: `@<path>:<l>:<c>` (bg) or `at <anonymous> (<path>:<fid>:<pc>)`. */
  raw: string;
  steps: Step[];
}

export async function computeFrame(
  testCase: Case,
  engine: Engine,
  bg: Map<string, MapEntry>,
  mainThread: Map<string, MainThreadEntry>,
): Promise<ComputedFrame> {
  if (testCase.kind === 'main-thread') {
    const r = await inferMainThread(testCase.marker, mainThread);
    return {
      code: 0,
      release: `debugmetadata:${r.release}`,
      raw: `at <anonymous> (${r.path}:${r.functionId}:${r.pc})`,
      steps: r.steps,
    };
  }
  const frame = inferBgFrame(
    testCase.find,
    testCase.token,
    testCase.err,
    engine,
    bg,
  );
  const entry = bg.get(frame.release);
  const step = entry
    ? await resolveStep(entry.map, frame.lineno, frame.colno - 1)
    : null;
  return {
    code: 0,
    release: `debugmetadata:${frame.release}`,
    raw: `@${entry?.path ?? ''}:${frame.lineno}:${frame.colno}`,
    steps: step ? [step] : [],
  };
}

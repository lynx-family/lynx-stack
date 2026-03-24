/**
 * mts-ref.test.ts
 *
 * Verifies the main-thread ref pipeline for :main-thread-ref bindings.
 *
 * What this tests
 * ─────────────────────────────────────────────────────────────────────────
 *  1. SET_MT_REF (op 12) appears in the ops buffer sent to MT.
 *  2. The op's refImpl matches the MainThreadRef that was bound.
 *  3. refImpl._wvid is predictable after resetForTesting (nextWvid resets to 1).
 *  4. refImpl._initValue is forwarded correctly.
 *  5. Binding multiple refs to sibling elements emits one op per ref.
 *
 * What this does NOT test (requires worklet-runtime in LynxTestingEnv)
 * ─────────────────────────────────────────────────────────────────────────
 *  - lynxWorkletImpl._refImpl.updateWorkletRef actually being called on MT.
 *  - The ref .value being readable inside a worklet after the element mounts.
 *
 * Debugging guide
 * ─────────────────────────────────────────────────────────────────────────
 *  Each test emits diagnostic console.info lines prefixed [mts-ref].
 *  If SET_MT_REF is missing from the ops:
 *   • node-ops.ts patchProp "main-thread-ref" branch may not be emitting the op.
 *   • Check that MainThreadRef.toJSON() serialises { _wvid, _initValue }.
 *   • Confirm the prop key is exactly 'main-thread-ref' (not 'mainThreadRef').
 *  If _wvid is wrong:
 *   • resetForTesting() (called inside render()) resets nextWvid to 1.
 *     A ref created inside setup() (after the reset) gets _wvid=1.
 *     A ref created before render() gets a pre-reset _wvid — capture it from
 *     the ref object and compare rather than hard-coding the number.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, defineComponent, useMainThreadRef } from '@lynx-js/vue-runtime';
import { render } from '../index.js';

// ─── Op layout constants (mirror of runtime/src/ops.ts — keep in sync) ──────

const OP_SIZE: Record<number, number> = {
  0: 3, // CREATE:            [code, id, type]
  1: 2, // CREATE_TEXT:       [code, id]
  2: 4, // INSERT:            [code, parentId, childId, anchorId]
  3: 3, // REMOVE:            [code, parentId, childId]
  4: 4, // SET_PROP:          [code, id, key, value]
  5: 3, // SET_TEXT:          [code, id, text]
  6: 5, // SET_EVENT:         [code, id, eventType, eventName, sign]
  7: 4, // REMOVE_EVENT:      [code, id, eventType, eventName]
  8: 3, // SET_STYLE:         [code, id, styleValue]
  9: 3, // SET_CLASS:         [code, id, classString]
  10: 3, // SET_ID:            [code, id, idString]
  11: 5, // SET_WORKLET_EVENT: [code, id, eventType, eventName, workletCtx]
  12: 3, // SET_MT_REF:        [code, id, refImpl]
};

interface ParsedOp {
  code: number;
  args: unknown[];
  offset: number;
}

/** Walk a flat ops buffer and return structured ops. */
function parseOps(raw: unknown[]): ParsedOp[] {
  const result: ParsedOp[] = [];
  let i = 0;
  while (i < raw.length) {
    const code = raw[i] as number;
    const size = OP_SIZE[code];
    if (size === undefined) {
      console.warn(
        `[mts-ref] parseOps: unknown op code ${code} at index ${i}. `
          + `Remaining: ${JSON.stringify(raw.slice(i))}`,
      );
      break;
    }
    result.push({ code, args: raw.slice(i + 1, i + size), offset: i });
    i += size;
  }
  return result;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('main-thread ref (:main-thread-ref)', () => {
  let callLepusSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    const nativeApp = (globalThis as any).lynx?.getNativeApp?.();
    if (nativeApp?.callLepusMethod) {
      callLepusSpy = vi.spyOn(nativeApp, 'callLepusMethod');
    } else {
      console.warn(
        '[mts-ref] nativeApp.callLepusMethod not found — ops capture disabled',
      );
    }
  });

  afterEach(() => {
    callLepusSpy = null;
    vi.restoreAllMocks();
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  function capturedParsedOps(): ParsedOp[] {
    if (!callLepusSpy) return [];
    const all: ParsedOp[] = [];
    for (const call of callLepusSpy.mock.calls) {
      if (call[0] !== 'vuePatchUpdate') continue;
      try {
        const raw = JSON.parse((call[1] as any).data) as unknown[];
        const parsed = parseOps(raw);
        all.push(...parsed);
        console.info(
          '[mts-ref] vuePatchUpdate ops:',
          parsed
            .map((op) => `[${op.code}] ${JSON.stringify(op.args)}`)
            .join(' | '),
        );
      } catch (e) {
        console.error(
          '[mts-ref] Failed to parse vuePatchUpdate payload:',
          call[1],
        );
      }
    }
    return all;
  }

  // ── Test 1: op appears in the buffer ────────────────────────────────────

  it('emits SET_MT_REF (op 12) for :main-thread-ref', () => {
    // Create the ref before render. We capture _wvid from the object so that
    // the test remains valid regardless of the counter state when this test runs.
    const mtRef = useMainThreadRef(null);

    const Comp = defineComponent({
      setup() {
        return () => h('view', { 'main-thread-ref': mtRef });
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const refOps = parsed.filter((op) => op.code === 12);

    console.info(
      `[mts-ref] SET_MT_REF (12) found: ${refOps.length}x`,
      refOps.map((op) => JSON.stringify(op.args)),
    );

    expect(
      refOps.length,
      [
        'No SET_MT_REF (code 12) found in the ops buffer.',
        'All op codes seen: [' + parsed.map((op) => op.code).join(', ') + ']',
        'Troubleshoot: check node-ops.ts patchProp "main-thread-ref" branch.',
        'It should call pushOp(OP.SET_MT_REF, el.id, nextValue.toJSON()).',
      ].join('\n'),
    ).toBeGreaterThan(0);
  });

  // ── Test 2: op contains matching _wvid ──────────────────────────────────

  it('SET_MT_REF refImpl._wvid matches the bound MainThreadRef', () => {
    const mtRef = useMainThreadRef(null);
    const expectedWvid = mtRef._wvid;

    const Comp = defineComponent({
      setup() {
        return () => h('view', { 'main-thread-ref': mtRef });
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const refOps = parsed.filter((op) => op.code === 12);

    expect(
      refOps.length,
      `No SET_MT_REF in ops. Codes: [${parsed.map((o) => o.code).join(', ')}]`,
    ).toBeGreaterThan(0);

    // SET_MT_REF args: [id, refImpl]
    const [_id, refImpl] = refOps[0].args as [
      number,
      { _wvid: number; _initValue: unknown },
    ];

    console.info(
      `[mts-ref] refImpl=${
        JSON.stringify(refImpl)
      }, expectedWvid=${expectedWvid}`,
    );

    expect(
      refImpl._wvid,
      `refImpl._wvid (${refImpl._wvid}) should match the MainThreadRef._wvid (${expectedWvid}). `
        + 'Check MainThreadRef.toJSON() returns { _wvid, _initValue }.',
    ).toBe(expectedWvid);
  });

  // ── Test 3: _wvid is 1 for first ref created inside setup after reset ────

  it('first ref created inside setup() gets _wvid=1 after resetForTesting', () => {
    // render() calls resetForTesting() before mounting the component.
    // resetForTesting() resets nextWvid to 1.
    // A ref created inside setup() (which runs during mount, after the reset)
    // therefore gets _wvid=1.
    let capturedWvid = -1;

    const Comp = defineComponent({
      setup() {
        // This ref is created AFTER resetForTesting() — nextWvid is 1 here.
        const myRef = useMainThreadRef(null);
        capturedWvid = myRef._wvid;
        return () => h('view', { 'main-thread-ref': myRef });
      },
    });

    render(Comp);

    console.info(`[mts-ref] capturedWvid inside setup: ${capturedWvid}`);

    expect(
      capturedWvid,
      'First useMainThreadRef() inside setup() should get _wvid=1 after resetForTesting(). '
        + 'If not 1, resetMainThreadRefState() may not be called in resetForTesting().',
    ).toBe(1);

    const parsed = capturedParsedOps();
    const refOps = parsed.filter((op) => op.code === 12);

    expect(
      refOps.length,
      `No SET_MT_REF op emitted. All ops: [${
        parsed.map((o) => o.code).join(', ')
      }]`,
    ).toBeGreaterThan(0);

    const [_id, refImpl] = refOps[0].args as [
      number,
      { _wvid: number; _initValue: unknown },
    ];
    expect(refImpl._wvid).toBe(1);
  });

  // ── Test 4: _initValue is forwarded correctly ────────────────────────────

  it('SET_MT_REF refImpl._initValue matches the value passed to useMainThreadRef', () => {
    const initData = { tag: 'hello', score: 42 };
    let capturedWvid = -1;

    const Comp = defineComponent({
      setup() {
        const myRef = useMainThreadRef(initData);
        capturedWvid = myRef._wvid;
        return () => h('view', { 'main-thread-ref': myRef });
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const refOps = parsed.filter((op) => op.code === 12);

    expect(
      refOps.length,
      `No SET_MT_REF op. Codes: [${parsed.map((o) => o.code).join(', ')}]`,
    ).toBeGreaterThan(0);

    const [_id, refImpl] = refOps[0].args as [
      number,
      { _wvid: number; _initValue: unknown },
    ];
    console.info(`[mts-ref] refImpl=${JSON.stringify(refImpl)}`);

    expect(
      refImpl._initValue,
      'refImpl._initValue should equal the init value passed to useMainThreadRef. '
        + 'Check MainThreadRef.toJSON() includes _initValue.',
    ).toEqual(initData);

    expect(refImpl._wvid).toBe(capturedWvid);
  });

  // ── Test 5: multiple refs produce one op each ────────────────────────────

  it('two :main-thread-ref bindings each emit their own SET_MT_REF op', () => {
    let wvidA = -1;
    let wvidB = -1;

    const Comp = defineComponent({
      setup() {
        const refA = useMainThreadRef('a');
        const refB = useMainThreadRef('b');
        wvidA = refA._wvid;
        wvidB = refB._wvid;
        return () =>
          h('view', null, [
            h('view', { 'main-thread-ref': refA }),
            h('view', { 'main-thread-ref': refB }),
          ]);
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const refOps = parsed.filter((op) => op.code === 12);

    console.info(
      `[mts-ref] SET_MT_REF count (expected 2): ${refOps.length}`,
      `wvidA=${wvidA} wvidB=${wvidB}`,
      refOps.map((op) => JSON.stringify(op.args)),
    );

    expect(
      refOps.length,
      `Expected 2 SET_MT_REF ops (one per ref). Got ${refOps.length}.\n`
        + `All ops: ${parsed.map((o) => `[${o.code}]`).join(' ')}`,
    ).toBe(2);

    const wvids = refOps.map((op) => (op.args[1] as { _wvid: number })._wvid);
    console.info('[mts-ref] wvids in ops:', wvids, 'expected:', [wvidA, wvidB]);

    expect(wvids).toContain(wvidA);
    expect(wvids).toContain(wvidB);
    expect(wvidA, 'The two refs should have different _wvid values').not.toBe(
      wvidB,
    );
  });
});

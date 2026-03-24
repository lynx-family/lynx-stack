/**
 * mts-worklet.test.ts
 *
 * Verifies the main-thread worklet event pipeline for hand-crafted worklet
 * context objects bound via :main-thread-bindtap (and similar suffixes).
 *
 * What this tests
 * ─────────────────────────────────────────────────────────────────────────
 *  1. SET_WORKLET_EVENT (op 11) appears in the ops buffer sent to MT.
 *  2. The op carries the correct eventType / eventName / context object.
 *  3. applyOps calls __AddEvent with { type: 'worklet', value: ctx }.
 *  4. When the element is tapped, the worklet path (runWorklet) is taken,
 *     NOT the BG publishEvent path.
 *
 * What this does NOT test (requires worklet-runtime loaded in LynxTestingEnv)
 * ─────────────────────────────────────────────────────────────────────────
 *  - The worklet function body actually executing.
 *  - Main-thread state mutations via worklet captures.
 *
 * Debugging guide
 * ─────────────────────────────────────────────────────────────────────────
 *  Each test emits diagnostic console.info lines prefixed [mts-worklet].
 *  If a test fails, check:
 *   • "All ops" log — is op 11 present?  If not, patchProp in node-ops.ts
 *     may not be handling the 'main-thread-' prefix correctly.
 *   • "__AddEvent calls" log — was __AddEvent called at all?  If not, check
 *     ops-apply.ts SET_WORKLET_EVENT branch.
 *   • "runWorklet / publishEvent call counts" — if runWorklet=0, the PAPI
 *     listener may not be registering the worklet event, or the element was
 *     not found in the elements map.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, defineComponent } from '@lynx-js/vue-runtime';
import { render, fireEvent } from '../index.js';

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
        `[mts-worklet] parseOps: unknown op code ${code} at index ${i}. `
          + `Remaining buffer: ${JSON.stringify(raw.slice(i))}`,
      );
      break;
    }
    result.push({ code, args: raw.slice(i + 1, i + size), offset: i });
    i += size;
  }
  return result;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('main-thread worklet events (:main-thread-bindtap)', () => {
  /**
   * Spy on the nativeApp's callLepusMethod so we can capture the full flat
   * ops array sent to vuePatchUpdate on the Main Thread.  The spy is set up
   * fresh each test and torn down in afterEach.
   */
  let callLepusSpy: ReturnType<typeof vi.spyOn> | null = null;

  /**
   * Spy on __AddEvent on mainThread.globalThis so we can verify the exact
   * arguments passed by applyOps when it processes SET_WORKLET_EVENT.
   * (switchToMainThread copies this spy to globalThis during applyOps.)
   */
  let addEventSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    const nativeApp = (globalThis as any).lynx?.getNativeApp?.();
    if (nativeApp?.callLepusMethod) {
      callLepusSpy = vi.spyOn(nativeApp, 'callLepusMethod');
    } else {
      console.warn(
        '[mts-worklet] nativeApp.callLepusMethod not found — ops capture disabled',
      );
    }

    const mtGlobal = (globalThis as any).lynxTestingEnv?.mainThread?.globalThis;
    if (mtGlobal?.__AddEvent) {
      addEventSpy = vi.spyOn(mtGlobal, '__AddEvent');
    } else {
      console.warn(
        '[mts-worklet] mainThread.globalThis.__AddEvent not found — PAPI spy disabled',
      );
    }
  });

  afterEach(() => {
    callLepusSpy = null;
    addEventSpy = null;
    vi.restoreAllMocks();
  });

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Collect and parse all ops from vuePatchUpdate calls captured so far. */
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
          '[mts-worklet] vuePatchUpdate ops:',
          parsed
            .map((op) => `[${op.code}] ${JSON.stringify(op.args)}`)
            .join(' | '),
        );
      } catch (e) {
        console.error(
          '[mts-worklet] Failed to parse vuePatchUpdate payload:',
          call[1],
        );
      }
    }
    return all;
  }

  // ── Test 1: op is in the buffer ──────────────────────────────────────────

  it('emits SET_WORKLET_EVENT (op 11) for :main-thread-bindtap', () => {
    // A hand-crafted worklet context — the format the SWC LEPUS transform
    // produces for functions declared in <script main-thread>.
    const workletCtx = { _wkltId: 'test-bundle:0:onTap', _c: {} };

    const Comp = defineComponent({
      setup() {
        return () => h('view', { 'main-thread-bindtap': workletCtx });
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const workletOps = parsed.filter((op) => op.code === 11);

    console.info(
      `[mts-worklet] SET_WORKLET_EVENT (11) found: ${workletOps.length}x`,
      workletOps.map((op) => JSON.stringify(op.args)),
    );

    expect(
      workletOps.length,
      [
        'No SET_WORKLET_EVENT (code 11) found in the ops buffer.',
        'All op codes seen: [' + parsed.map((op) => op.code).join(', ') + ']',
        'Troubleshoot: check node-ops.ts patchProp "main-thread-" prefix handler',
        'and that the prop key "main-thread-bindtap" parses to { type:"bindEvent", name:"tap" }.',
      ].join('\n'),
    ).toBeGreaterThan(0);
  });

  // ── Test 2: op carries correct eventType / eventName / ctx ───────────────

  it('SET_WORKLET_EVENT carries correct eventType, eventName, and worklet context', () => {
    const workletCtx = { _wkltId: 'test-bundle:0:onTap', _c: { counter: 1 } };

    const Comp = defineComponent({
      setup() {
        return () => h('view', { 'main-thread-bindtap': workletCtx });
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const workletOps = parsed.filter((op) => op.code === 11);

    expect(
      workletOps.length,
      `No SET_WORKLET_EVENT in ops. Codes: [${
        parsed.map((o) => o.code).join(', ')
      }]`,
    ).toBeGreaterThan(0);

    // SET_WORKLET_EVENT args: [id, eventType, eventName, workletCtx]
    const [_id, eventType, eventName, ctx] = workletOps[0].args;
    console.info(
      `[mts-worklet] eventType=${String(eventType)} eventName=${
        String(eventName)
      } ctx=${JSON.stringify(ctx)}`,
    );

    expect(
      eventType,
      'eventType should be "bindEvent" for :main-thread-bindtap. '
        + 'Check parseEventProp() in node-ops.ts.',
    ).toBe('bindEvent');

    expect(
      eventName,
      'eventName should be "tap" for bindtap suffix. '
        + 'Check parseEventProp() strips "bind" prefix correctly.',
    ).toBe('tap');

    expect(
      ctx,
      'The worklet context should be forwarded as-is from the prop value.',
    ).toEqual(workletCtx);
  });

  // ── Test 3: applyOps calls __AddEvent with worklet shape ─────────────────

  it('applyOps passes { type: "worklet", value: ctx } to __AddEvent on MT', () => {
    if (!addEventSpy) {
      console.warn(
        '[mts-worklet] __AddEvent spy unavailable — skipping PAPI shape check. '
          + 'Ensure mainThread.globalThis.__AddEvent exists in LynxTestingEnv.',
      );
      return;
    }

    const workletCtx = { _wkltId: 'test-bundle:0:onTap', _c: {} };
    const Comp = defineComponent({
      setup() {
        return () => h('view', { 'main-thread-bindtap': workletCtx });
      },
    });

    render(Comp);

    const calls = addEventSpy.mock.calls;
    console.info(
      '[mts-worklet] __AddEvent calls (' + calls.length + 'x):',
      calls
        .map(
          ([_el, type, name, handler]) =>
            `(type=${String(type)}, name=${String(name)}, handler=${
              JSON.stringify(handler)
            })`,
        )
        .join(' | '),
    );

    const workletCall = calls.find(
      ([_el, _type, _name, handler]) =>
        typeof handler === 'object'
        && handler !== null
        && (handler as any).type === 'worklet',
    );

    expect(
      workletCall,
      [
        '__AddEvent was never called with a worklet handler { type: "worklet" }.',
        'Actual __AddEvent call handlers: '
        + calls.map(([_el, _t, _n, h]) => JSON.stringify(h)).join(', '),
        'Troubleshoot: check ops-apply.ts SET_WORKLET_EVENT case builds',
        '{ type: "worklet", value: ctx } correctly before calling __AddEvent.',
      ].join('\n'),
    ).toBeTruthy();

    const [_el, eventType, eventName, handler] = workletCall!;
    expect(eventType).toBe('bindEvent');
    expect(eventName).toBe('tap');
    expect(
      (handler as any).value,
      'handler.value should equal the worklet ctx',
    ).toEqual(workletCtx);
  });

  // ── Test 4: tapping calls runWorklet, not publishEvent ───────────────────

  it('tapping the element invokes runWorklet (not publishEvent) on MT', () => {
    const mtGlobal = (globalThis as any).lynxTestingEnv?.mainThread?.globalThis;
    if (!mtGlobal) {
      console.warn(
        '[mts-worklet] mainThread.globalThis not accessible — skipping behavioral test',
      );
      return;
    }

    // Stub runWorklet on MT before render so the PAPI listener can call it.
    // switchToMainThread() copies this stub to globalThis.runWorklet.
    const runWorkletStub = vi.fn();
    mtGlobal.runWorklet = runWorkletStub;

    const workletCtx = { _wkltId: 'test-bundle:0:onTap', _c: {} };
    const Comp = defineComponent({
      setup() {
        return () => h('view', { 'main-thread-bindtap': workletCtx });
      },
    });

    const { container } = render(Comp);
    const viewEl = container.querySelector('view');

    expect(
      viewEl,
      'Could not find <view> in rendered output. '
        + 'Check that the component renders a view element and render() returns JSDOM container.',
    ).toBeTruthy();

    // Spy on publishEvent to confirm the worklet path does NOT fall through to BG.
    const publishEventSpy = vi.spyOn(
      (globalThis as any).lynxCoreInject?.tt,
      'publishEvent',
    );

    fireEvent.tap(viewEl!);

    console.info(
      '[mts-worklet] after fireEvent.tap —',
      `runWorklet calls: ${runWorkletStub.mock.calls.length},`,
      `publishEvent calls: ${publishEventSpy.mock.calls.length}`,
    );
    if (runWorkletStub.mock.calls.length > 0) {
      console.info(
        '[mts-worklet] runWorklet first call ctx:',
        JSON.stringify(runWorkletStub.mock.calls[0][0]),
      );
    }

    expect(
      runWorkletStub.mock.calls.length,
      [
        'runWorklet was not called when the element was tapped.',
        'Expected 1 call. If 0: check that __AddEvent registered a worklet listener,',
        'that the element is found in the MT elements map,',
        'and that ElementPAPI fires the worklet branch of the event listener.',
      ].join('\n'),
    ).toBe(1);

    // runWorklet(ctx, [evt]) — first arg is the worklet context object
    const [firstArg] = runWorkletStub.mock.calls[0];
    expect(
      firstArg,
      'runWorklet first argument should be the worklet context. '
        + 'Check ops-apply.ts passes ctx as handler.value and ElementPAPI calls runWorklet(handler.value, ...).',
    ).toEqual(workletCtx);

    expect(
      publishEventSpy.mock.calls.length,
      'publishEvent should NOT be called for a worklet event (only BG function events use it).',
    ).toBe(0);

    // Cleanup stub to avoid leaking into subsequent tests
    delete mtGlobal.runWorklet;
  });

  // ── Test 5: only one worklet event registered per element ────────────────

  it('registers exactly one worklet event when multiple sibling elements exist', () => {
    const workletCtx = { _wkltId: 'test-bundle:0:onTap', _c: {} };

    const Comp = defineComponent({
      setup() {
        return () =>
          h('view', null, [
            // Only the inner view has the worklet binding
            h('view', { 'main-thread-bindtap': workletCtx }),
            h('text', null, 'label'),
          ]);
      },
    });

    render(Comp);

    const parsed = capturedParsedOps();
    const workletOps = parsed.filter((op) => op.code === 11);

    console.info(
      `[mts-worklet] SET_WORKLET_EVENT count (expected 1): ${workletOps.length}`,
      workletOps.map((op) => JSON.stringify(op.args)),
    );

    expect(
      workletOps.length,
      `Expected exactly 1 SET_WORKLET_EVENT op. Got ${workletOps.length}.\n`
        + `All ops: ${parsed.map((o) => `[${o.code}]`).join(' ')}`,
    ).toBe(1);
  });
});

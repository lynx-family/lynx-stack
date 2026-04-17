import { describe, expect, it } from 'vitest';

import { root } from '../../../src/element-template/index.js';
import { resetTemplateId } from '../../../src/element-template/runtime/template/handle.js';
import { ElementTemplateRegistry } from '../../../src/element-template/runtime/template/registry.js';

import { installMockNativePapi } from '../test-utils/mock/mockNativePapi.js';

declare const renderPage: (data?: Record<string, unknown>) => void;

const enabled = process.env['ET_PERF'] === '1';

const describePerf = enabled ? describe : describe.skip;

function createSpanRecorder() {
  const stack: { name: string; start: number }[] = [];
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();

  return {
    start(name: string) {
      stack.push({ name, start: performance.now() });
    },
    end() {
      const current = stack.pop();
      if (!current) {
        return;
      }
      const dt = performance.now() - current.start;
      totals.set(current.name, (totals.get(current.name) ?? 0) + dt);
      counts.set(current.name, (counts.get(current.name) ?? 0) + 1);
    },
    getTotalMs(name: string) {
      return totals.get(name) ?? 0;
    },
    getCount(name: string) {
      return counts.get(name) ?? 0;
    },
  };
}

function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('median(): empty values');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const v = sorted[mid];
  if (typeof v !== 'number') {
    throw new Error('median(): unexpected value');
  }
  return v;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error('percentile(): empty values');
  }
  if (!(p >= 0 && p <= 1)) {
    throw new Error(`percentile(): invalid p ${String(p)}`);
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  const v = sorted[idx];
  if (typeof v !== 'number') {
    throw new Error('percentile(): unexpected value');
  }
  return v;
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got '${raw}'`);
  }
  return n;
}

describePerf('ET perf (local): renderPage() only', () => {
  it('render-page four-layer-views', () => {
    const warmup = readIntEnv('ET_PERF_WARMUP', 3);
    const iterations = readIntEnv('ET_PERF_ITERATIONS', 10);

    const perf = globalThis.lynx?.performance;
    if (!perf || typeof perf.profileStart !== 'function' || typeof perf.profileEnd !== 'function') {
      throw new Error('ET_PERF requires globalThis.lynx.performance.profileStart/profileEnd');
    }

    const timesMs: number[] = [];
    const renderMainThreadMs: number[] = [];
    const renderOpcodesMs: number[] = [];
    const packInstancesMs: number[] = [];

    for (let i = 0; i < warmup + iterations; i++) {
      // NOTE: do NOT clearTemplatesOnCleanup here.
      // Templates are registered at module-eval time by the vitest transform plugin.
      // If we clear templates between iterations, subsequent iterations would fail with
      // "Template '_et_xxx' not found in registry".
      const mockContext = installMockNativePapi({ clearTemplatesOnCleanup: false });
      ElementTemplateRegistry.clear();
      resetTemplateId();
      (globalThis as { __USE_ELEMENT_TEMPLATE__?: boolean }).__USE_ELEMENT_TEMPLATE__ = true;

      try {
        const spans = createSpanRecorder();

        // renderMainThread.ts uses profileStart/profileEnd from src/debug/utils.ts,
        // which binds lynx.performance.profileStart/profileEnd at module-eval time.
        // To ensure we can record spans, keep function identity and swap mock impl.
        if (
          typeof perf.profileStart === 'function' && typeof (perf.profileStart as any).mockImplementation === 'function'
        ) {
          (perf.profileStart as any).mockImplementation((name: string) => {
            spans.start(name);
          });
        }
        if (
          typeof perf.profileEnd === 'function' && typeof (perf.profileEnd as any).mockImplementation === 'function'
        ) {
          (perf.profileEnd as any).mockImplementation(() => {
            spans.end();
          });
        }

        function App() {
          return (
            <view style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {Array.from({ length: 3 })
                .fill(1)
                .map((_v, i0) => (
                  <view
                    key={`l0-${i0}`}
                    style={{
                      margin: '1px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'row',
                      backgroundColor: '#fa43e6',
                    }}
                  >
                    {Array.from({ length: 16 })
                      .fill(1)
                      .map((_v, i1) => (
                        <view
                          key={`l1-${i0}-${i1}`}
                          style={{
                            margin: '1px',
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            backgroundColor: '#cccccc',
                          }}
                        >
                          {Array.from({ length: 16 })
                            .fill(1)
                            .map((_v, i2) => (
                              <view
                                key={`l2-${i0}-${i1}-${i2}`}
                                style={{
                                  margin: '1px',
                                  height: '100%',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  backgroundColor: '#333333',
                                }}
                              >
                                {Array.from({ length: 8 })
                                  .fill(1)
                                  .map((_v, i3) => (
                                    <view
                                      key={`l3-${i0}-${i1}-${i2}-${i3}`}
                                      style={{ width: '15%', height: '15%', margin: '1px', backgroundColor: 'red' }}
                                    >
                                    </view>
                                  ))}
                              </view>
                            ))}
                        </view>
                      ))}
                  </view>
                ))}
            </view>
          );
        }

        root.render(<App />);

        const t0 = performance.now();
        renderPage(undefined);
        const t1 = performance.now();

        // Sanity check: renderPage should create at least one template instance.
        // This also helps ensure we don't accidentally benchmark an empty path.
        expect(mockContext.mockCreateElementTemplate.mock.calls.length).toBeGreaterThan(0);

        if (i >= warmup) {
          timesMs.push(t1 - t0);

          renderMainThreadMs.push(spans.getTotalMs('ReactLynx::renderMainThread'));
          renderOpcodesMs.push(spans.getTotalMs('ReactLynx::renderOpcodes'));
          packInstancesMs.push(spans.getTotalMs('ReactLynx::packSerializedETInstance'));

          // Help catch accidental span disablement.
          expect(spans.getCount('ReactLynx::renderMainThread')).toBeGreaterThan(0);
          expect(spans.getCount('ReactLynx::renderOpcodes')).toBeGreaterThan(0);
          expect(spans.getCount('ReactLynx::packSerializedETInstance')).toBeGreaterThan(0);
        }
      } finally {
        (globalThis as { __USE_ELEMENT_TEMPLATE__?: boolean }).__USE_ELEMENT_TEMPLATE__ = undefined;
        mockContext.cleanup();
      }
    }

    const min = Math.min(...timesMs);
    const med = median(timesMs);
    const p90 = percentile(timesMs, 0.9);

    const mtMed = median(renderMainThreadMs);
    const opMed = median(renderOpcodesMs);
    const packMed = median(packInstancesMs);

    // This is a local-only benchmark. Prefer printing numbers over hard thresholds.
    // eslint-disable-next-line no-console
    console.log(
      `[ET_PERF] renderPage four-layer-views: iterations=${timesMs.length} min=${min.toFixed(2)}ms median=${
        med.toFixed(2)
      }ms p90=${p90.toFixed(2)}ms`
        + ` | spans(median): renderMainThread=${mtMed.toFixed(2)}ms renderOpcodes=${
          opMed.toFixed(2)
        }ms packSerializedETInstance=${packMed.toFixed(2)}ms`,
    );
  });
});

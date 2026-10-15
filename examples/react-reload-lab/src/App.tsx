import {
  Suspense,
  lazy,
  runOnBackground,
  runOnMainThread,
  useCallback,
  useGlobalProps,
  useInitData,
  useMainThreadRef,
  useState,
} from '@lynx-js/react';
import type { MainThread, NodesRef } from '@lynx-js/types';

import './App.css';
import {
  beginElementPapiCapture,
  readElementPapiCapture,
} from './element-papi-trace.js';
import type { ElementPapiTraceSnapshot } from './element-papi-trace.js';
import { ListExample } from './ListExample.js';

const LazyComponent = lazy(() => import('./LazyComponent.js'));

interface LynxTestModule {
  updateGlobalProps: (props: Record<string, unknown>) => void;
  reloadTemplate: (
    data: Record<string, unknown>,
    props: Record<string, unknown>,
  ) => void;
}

const runtimeEpochKey = Symbol.for('__REACT_LYNX_RELOAD_LAB_EPOCH__');
const lynxSymbols = lynx as unknown as Record<symbol, number | undefined>;
lynxSymbols[runtimeEpochKey] = (lynxSymbols[runtimeEpochKey] ?? 0) + 1;
const runtimeEpoch = lynxSymbols[runtimeEpochKey] ?? 1;

lynx.performance.profileStart('reloadLab::main-bundle-eval');
let mainBundleCounter = 0;
lynx.performance.profileEnd();

function getLynxTestModule(): LynxTestModule | undefined {
  return (NativeModules as unknown as { LynxTestModule?: LynxTestModule })
    .LynxTestModule;
}

function formatGlobalPropsTime(timestamp: number | undefined): string {
  if (timestamp === undefined) return 'Not set';
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(
    value => pad(value),
  )
    .join('-');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map(
    value => pad(value),
  )
    .join(':');
  return `${day} ${time}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function App() {
  const reloadData = useInitData() as {
    dataCnt?: number;
    reloadLabDataRetained?: string;
  };
  const { reloadLabGlobalPropsTick } = useGlobalProps() as {
    reloadLabGlobalPropsTick?: number;
  };
  const [mainThreadDataCnt, setMainThreadDataCnt] = useState<number | null>(
    null,
  );
  const readMainThreadData = useCallback(
    (element: MainThread.Element | null) => {
      'main thread';
      if (element) {
        void runOnBackground(setMainThreadDataCnt)(
          Number(
            (lynx as unknown as { __initData: { dataCnt?: number } }).__initData
              .dataCnt ?? 0,
          ),
        );
      }
    },
    [],
  );
  const [backgroundTaps, setBackgroundTaps] = useState(0);
  const [moduleTaps, setModuleTaps] = useState(0);
  const [mtsTaps, setMtsTaps] = useState(0);
  const [refStatus, setRefStatus] = useState('attaching');
  const [lastAction, setLastAction] = useState('Ready for reload checks');
  const [papiTrace, setPapiTrace] = useState<ElementPapiTraceSnapshot>({
    reloadId: 0,
    calls: [],
    droppedCalls: 0,
    previousReloads: [],
  });
  const mtsStateRef = useMainThreadRef<MainThread.Element>(null);

  const onBackgroundTap = useCallback(() => {
    'background-only';
    mainBundleCounter += 1;
    setBackgroundTaps(count => count + 1);
    setModuleTaps(mainBundleCounter);
    setLastAction('Background event handled once');
  }, []);

  const onMtsElementTap = useCallback((event: MainThread.TouchEvent) => {
    'main thread';
    // This Element PAPI mutation is outside React state, so reload does not reset it.
    mtsStateRef.current?.setAttribute('text', 'MTS state: tapped');
    event.currentTarget.animate([
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0.25, transform: 'scale(0.86)' },
      { opacity: 1, transform: 'scale(1.05)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: 700, iterations: 1 });
  }, [mtsStateRef]);

  const onMtsBridgeTap = useCallback(() => {
    'main thread';
    void runOnBackground((increment: number) => {
      setMtsTaps(count => count + increment);
      setLastAction('MTS event reached background once');
    })(1);
  }, []);

  const bindProbeRef = useCallback((node: NodesRef | null) => {
    'background-only';
    setRefStatus(node ? 'attached' : 'detached');
    if (node) {
      node.invoke({
        method: 'boundingClientRect',
        params: {},
      }).exec();
    }
  }, []);

  const reload = useCallback(() => {
    'background-only';
    const testModule = getLynxTestModule();
    if (!testModule) {
      setLastAction('LynxTestModule is unavailable');
      return;
    }
    void runOnMainThread(beginElementPapiCapture)()
      .then(() => {
        testModule.reloadTemplate({}, {});
      })
      .catch((error: unknown) => {
        setLastAction(`Could not start PAPI capture: ${String(error)}`);
      });
  }, []);

  const readPapiTrace = useCallback(() => {
    'background-only';
    void runOnMainThread(readElementPapiCapture)()
      .then((trace) => {
        const snapshot = trace as ElementPapiTraceSnapshot;
        setPapiTrace(snapshot);
        setLastAction(
          `Read ${snapshot.calls.length} Element PAPI calls from reload #${snapshot.reloadId}`,
        );
      })
      .catch((error: unknown) => {
        setLastAction(`Could not read PAPI capture: ${String(error)}`);
      });
  }, []);

  const papiReloads = papiTrace.reloadId > 0
    ? [...papiTrace.previousReloads, papiTrace]
    : papiTrace.previousReloads;

  return (
    <scroll-view className='Page' scroll-y>
      <view className='Hero'>
        <text className='Eyebrow'>REACTLYNX · RELOAD LAB</text>
        <text className='Title'>Reload Lab</text>
        <text className='Subtitle'>
          Check fresh runtime state, main-thread events and refs after
          reloadTemplate.
        </text>
        <view className='HeroFooter'>
          <text className='FeaturePill'>ENTRY RE-EVAL ON</text>
          <text className='RuntimeLabel'>RUNTIME #{runtimeEpoch}</text>
        </view>
      </view>

      <view className='Metrics'>
        <view className='MetricCard'>
          <text className='MetricLabel'>UI state</text>
          <text className='MetricValue'>{backgroundTaps}</text>
          <text className='MetricHint'>resets on reload</text>
        </view>
        <view className='MetricCard'>
          <text className='MetricLabel'>Main bundle counter</text>
          <text className='MetricValue'>{moduleTaps}</text>
          <text className='MetricHint'>fresh module starts at 0</text>
        </view>
        <view className='MetricCard'>
          <text className='MetricLabel'>MTS → BTS</text>
          <text className='MetricValue'>{mtsTaps}</text>
          <text className='MetricHint'>one update per tap</text>
        </view>
      </view>

      <view className='SectionHeading'>
        <text className='SectionTitle'>INTERACTION CHECKS</text>
        <text className='SectionHint'>Tap, reload, then tap again</text>
      </view>

      <view className='CheckCard'>
        <text className='CardTitle'>Native reload data</text>
        <text className='CardDescription'>
          Check data updates and omitted fields across reloads.
        </text>
        <text className='ResultText' main-thread:ref={readMainThreadData}>
          {`Main-thread dataCnt: ${mainThreadDataCnt ?? 'pending'}`}
        </text>
        <text className='ResultText'>
          {`Background dataCnt: ${reloadData.dataCnt ?? 0}`}
        </text>
        <text className='ResultText'>
          {`Retained field: ${reloadData.reloadLabDataRetained ?? 'Not set'}`}
        </text>
        <view
          className='GlobalPropsButton ActionButton ActionButton--blue'
          bindtap={() => {
            'background-only';
            getLynxTestModule()?.reloadTemplate({
              dataCnt: (reloadData.dataCnt ?? 0) + 1,
              reloadLabDataRetained: 'Set by data reload',
            }, {});
          }}
        >
          <text className='ActionText'>Reload with dataCnt +1</text>
        </view>
        <view
          className='GlobalPropsButton ActionButton ActionButton--quiet'
          bindtap={() => {
            'background-only';
            getLynxTestModule()?.reloadTemplate({
              dataCnt: (reloadData.dataCnt ?? 0) + 1,
            }, {});
          }}
        >
          <text className='ActionText'>Update dataCnt only (+1)</text>
        </view>
        <view
          className='GlobalPropsButton ActionButton ActionButton--quiet'
          bindtap={() => {
            'background-only';
            getLynxTestModule()?.reloadTemplate({}, {});
          }}
        >
          <text className='ActionText'>Reload with empty data</text>
        </view>
      </view>

      <view className='CheckCard'>
        <view className='CardHeader'>
          <view className='Step Step--violet'>
            <text className='StepText'>GP</text>
          </view>
          <view className='CardHeading'>
            <text className='CardTitle'>Native globalProps and reload</text>
            <text className='CardDescription'>
              Check that native globalProps updates survive reloadTemplate.
            </text>
          </view>
        </view>
        <view className='GlobalPropsValue'>
          <text className='MetricLabel'>reloadLabGlobalPropsTick</text>
          <text className='RuntimeLabel'>
            {formatGlobalPropsTime(reloadLabGlobalPropsTick)}
          </text>
        </view>
        <view
          className='ActionButton ActionButton--quiet'
          bindtap={() => {
            'background-only';
            const props = { reloadLabGlobalPropsTick: Date.now() };
            getLynxTestModule()?.updateGlobalProps(props);
          }}
        >
          <text className='ActionText'>Update native globalProps</text>
        </view>
        <view
          className='GlobalPropsButton ActionButton ActionButton--blue'
          bindtap={() => {
            'background-only';
            const testModule = getLynxTestModule();
            const props = { reloadLabGlobalPropsTick: Date.now() };
            testModule?.updateGlobalProps(props);
            testModule?.reloadTemplate({}, {});
          }}
        >
          <text className='ActionText'>Native props + reloadTemplate</text>
        </view>
        <view
          className='GlobalPropsButton ActionButton ActionButton--quiet'
          bindtap={() => {
            'background-only';
            const props = { reloadLabGlobalPropsTick: Date.now() };
            getLynxTestModule()?.reloadTemplate({}, props);
          }}
        >
          <text className='ActionText'>reloadTemplate with globalProps</text>
        </view>
      </view>

      <view className='CheckCard'>
        <view className='CardHeader'>
          <view className='Step'>
            <text className='StepText'>01</text>
          </view>
          <view className='CardHeading'>
            <text className='CardTitle'>Background event</text>
            <text className='CardDescription'>
              Checks UI state and module state reset.
            </text>
          </view>
        </view>
        <view
          className='ActionButton ActionButton--blue'
          bindtap={onBackgroundTap}
        >
          <text className='ActionText'>Increment background state</text>
        </view>
      </view>

      <view className='CheckCard'>
        <view className='CardHeader'>
          <view className='Step Step--mint'>
            <text className='StepText'>02</text>
          </view>
          <view className='CardHeading'>
            <text className='CardTitle'>MTS event and element API</text>
            <text className='CardDescription'>
              Element PAPI state persists after reload; React counters reset.
            </text>
          </view>
        </view>
        <view
          className='ActionButton ActionButton--mint'
          main-thread:bindtap={onMtsElementTap}
        >
          <text
            className='ActionText ActionText--dark'
            main-thread:ref={mtsStateRef}
          >
            MTS state: idle
          </text>
        </view>
      </view>

      <view className='CheckCard'>
        <view className='CardHeader'>
          <view className='Step Step--violet'>
            <text className='StepText'>03</text>
          </view>
          <view className='CardHeading'>
            <text className='CardTitle'>MTS → BTS bridge</text>
            <text className='CardDescription'>
              One main-thread tap should update BTS state once.
            </text>
          </view>
        </view>
        <view
          className='ActionButton ActionButton--quiet'
          main-thread:bindtap={onMtsBridgeTap}
        >
          <text className='ActionText'>Send one background update</text>
        </view>
      </view>

      <view className='CheckCard' ref={bindProbeRef}>
        <view className='CardHeader'>
          <view className='Step Step--mint'>
            <text className='StepText'>04</text>
          </view>
          <view className='CardHeading'>
            <text className='CardTitle'>Ref attachment</text>
            <text className='CardDescription'>
              Call boundingClientRect on every ref attach. Native errors expose
              stale refs after reload.
            </text>
          </view>
          <text className={`RefBadge RefBadge--${refStatus}`}>{refStatus}</text>
        </view>
      </view>

      <view className='CheckCard'>
        <view className='CardHeader'>
          <view className='Step Step--violet'>
            <text className='StepText'>05</text>
          </view>
          <view className='CardHeading'>
            <text className='CardTitle'>Element PAPI trace</text>
            <text className='CardDescription'>
              Capture Create, Set, Insert, Remove and Flush calls for each
              reload.
            </text>
          </view>
        </view>
        <view className='TraceSummary'>
          <text className='TraceSummaryText'>
            {papiTrace.reloadId > 0
              ? `Reload #${papiTrace.reloadId} · ${papiTrace.calls.length} calls`
              : 'No reload captured yet'}
          </text>
          <view className='TraceButton' bindtap={readPapiTrace}>
            <text className='TraceButtonText'>SHOW LOG</text>
          </view>
        </view>
        {papiReloads.length > 0
          ? (
            <view className='TraceList'>
              {papiReloads.slice().reverse().map((reload) => (
                <view className='TraceCycle' key={`reload-${reload.reloadId}`}>
                  <text className='TraceCycleTitle'>
                    {`Reload #${reload.reloadId} · ${reload.calls.length} calls`}
                  </text>
                  {reload.calls.slice(0, 36).map((call, index) => (
                    <text
                      className='TraceLine'
                      key={`${reload.reloadId}-${index}`}
                    >
                      {`${String(index + 1).padStart(2, '0')}  ${call}`}
                    </text>
                  ))}
                  {reload.droppedCalls > 0
                    ? (
                      <text className='TraceOverflow'>
                        {`${reload.droppedCalls} more calls omitted`}
                      </text>
                    )
                    : null}
                </view>
              ))}
            </view>
          )
          : null}
      </view>

      <view className='ReloadPanel'>
        <view className='ReloadCopy'>
          <text className='ReloadTitle'>Run reloadTemplate</text>
          <text className='ReloadHint'>
            Runtime epoch should advance; counters should reset.
          </text>
        </view>
        <view className='ReloadButton' bindtap={reload}>
          <text className='ReloadButtonText'>RELOAD</text>
        </view>
      </view>

      <view className='ResultBar'>
        <view className='LiveDot' />
        <text className='ResultLabel'>LATEST CHECK</text>
        <text className='ResultText'>{lastAction}</text>
      </view>

      <text className='FooterNote'>
        Repeat reloads, then confirm each background and MTS tap increments
        once.
      </text>

      <ListExample onReload={reload} />

      <Suspense fallback={<text>Loading...</text>}>
        <LazyComponent />
      </Suspense>
    </scroll-view>
  );
}

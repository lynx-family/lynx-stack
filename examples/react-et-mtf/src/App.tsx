import {
  runOnBackground,
  runOnMainThread,
  useCallback,
  useEffect,
  useState,
} from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './App.css';

const NOT_RUN = 'Not run';

let backgroundSequence = 0;

interface ExposureEventItem {
  'exposure-id'?: unknown;
}

type ExposureListener = (events: unknown) => void;

const EXPOSURE_ID_PREFIX = 'react-et-mtf-exposure';
const EXPOSURE_LISTENER_KEY = '__reactEtMtfExposureListener';

type MainThreadGlobal = typeof globalThis & {
  [EXPOSURE_LISTENER_KEY]?: ExposureListener;
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function checkCardClass(passed: boolean): string {
  return passed ? 'CheckCard CheckCard--pass' : 'CheckCard';
}

function checkBadgeClass(passed: boolean): string {
  return passed ? 'CheckBadge CheckBadge--pass' : 'CheckBadge';
}

function checkBadgeText(passed: boolean): string {
  return passed ? 'PASS' : 'RUN';
}

export function App() {
  const [status, setStatus] = useState('Ready');
  const [directResult, setDirectResult] = useState(NOT_RUN);
  const [nestedResult, setNestedResult] = useState(NOT_RUN);
  const [burstResult, setBurstResult] = useState(NOT_RUN);
  const [payloadResult, setPayloadResult] = useState(NOT_RUN);
  const [mainDirectResult, setMainDirectResult] = useState(NOT_RUN);
  const [mainRoundTripResult, setMainRoundTripResult] = useState(NOT_RUN);
  const [exposureResult, setExposureResult] = useState(NOT_RUN);
  const [exposureListenerReady, setExposureListenerReady] = useState(false);
  const [exposureRun, setExposureRun] = useState(0);
  const [completedUpdates, setCompletedUpdates] = useState(0);

  useEffect(() => {
    console.info('Hello, ReactLynx ET MTF');
  }, []);

  const pulse = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    e.currentTarget.animate([
      {
        transform: 'scale(1)',
      },
      {
        transform: 'scale(0.96)',
      },
      {
        transform: 'scale(1)',
      },
    ], {
      duration: 180,
      iterations: 1,
    });
  }, []);

  const echoOnMainThread = useCallback(
    (payload: { source: string; value: number }) => {
      'main thread';
      return `${payload.source} #${payload.value}`;
    },
    [],
  );

  const configureExposureListener = useCallback((enabled: boolean) => {
    'main thread';
    const emitter = lynx.getJSModule('GlobalEventEmitter');
    const mainThreadGlobal = globalThis as MainThreadGlobal;
    const listener = mainThreadGlobal[EXPOSURE_LISTENER_KEY];

    if (!enabled) {
      if (listener) {
        emitter.removeListener('exposure', listener);
        delete mainThreadGlobal[EXPOSURE_LISTENER_KEY];
      }
      return;
    }

    if (listener) {
      return;
    }

    const handledExposureIds = new Set<string>();
    const nextListener = (events: unknown) => {
      if (!Array.isArray(events)) {
        return;
      }

      let exposureId: string | undefined;
      for (const event of events) {
        if (typeof event !== 'object' || event === null) {
          continue;
        }
        const candidate = (event as ExposureEventItem)['exposure-id'];
        if (
          typeof candidate === 'string'
          && candidate.startsWith(`${EXPOSURE_ID_PREFIX}-`)
          && candidate !== `${EXPOSURE_ID_PREFIX}-0`
          && !handledExposureIds.has(candidate)
        ) {
          exposureId = candidate;
          break;
        }
      }
      if (!exposureId) {
        return;
      }

      handledExposureIds.add(exposureId);
      void runOnBackground((receivedExposureId: string) => {
        backgroundSequence += 1;
        setStatus('Exposure event check passed');
        setExposureResult(
          `exposure-id ${receivedExposureId} reached background #${backgroundSequence}`,
        );
        setCompletedUpdates((count) => count + 1);
      })(exposureId);
    };
    mainThreadGlobal[EXPOSURE_LISTENER_KEY] = nextListener;
    emitter.addListener('exposure', nextListener);
  }, []);

  useEffect(() => {
    void runOnMainThread(configureExposureListener)(true)
      .then(() => setExposureListenerReady(true))
      .catch((error: unknown) => {
        setStatus('Exposure event setup failed');
        setExposureResult(`Error: ${formatError(error)}`);
      });
    return () => {
      void runOnMainThread(configureExposureListener)(false).catch(
        (error: unknown) => {
          console.error('Failed to remove exposure listener', error);
        },
      );
    };
  }, [configureExposureListener]);

  const onExposureRun = useCallback(() => {
    if (!exposureListenerReady) {
      setStatus('Exposure listener is not ready');
      return;
    }
    const nextRun = exposureRun + 1;
    setExposureRun(nextRun);
  }, [exposureListenerReady, exposureRun]);

  const runNestedReport = useCallback((label: string) => {
    'main thread';
    void runOnBackground((nestedLabel: string) => {
      backgroundSequence += 1;
      setStatus('Nested background check passed');
      setNestedResult(
        `nested ${nestedLabel} reached background #${backgroundSequence}`,
      );
      setCompletedUpdates((count) => count + 1);
    })(label);
  }, []);

  const onDirectTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    pulse(e);
    void runOnBackground((label: string) => {
      backgroundSequence += 1;
      setStatus('Main-thread event check passed');
      setDirectResult(
        `${label} event reached background #${backgroundSequence}`,
      );
      setCompletedUpdates((count) => count + 1);
    })('tap');
  }, [pulse]);

  const onNestedTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    pulse(e);
    runNestedReport('tap');
  }, [pulse, runNestedReport]);

  const onBurstTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    pulse(e);
    const runBurstPart = runOnBackground((label: string) => {
      backgroundSequence += 1;
      const value = `${label} #${backgroundSequence}`;
      setStatus('Three-call background check passed');
      setBurstResult((current) =>
        label === 'a' || current === NOT_RUN ? value : `${current} / ${value}`
      );
      setCompletedUpdates((count) => count + 1);
    });
    void runBurstPart('a');
    void runBurstPart('b');
    void runBurstPart('c');
  }, [pulse]);

  const onPayloadTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    pulse(e);
    void runOnBackground((payload: { source: string; value: number }) => {
      backgroundSequence += 1;
      setStatus('Object payload check passed');
      setPayloadResult(
        `${payload.source} ${payload.value} reached background #${backgroundSequence}`,
      );
      setCompletedUpdates((count) => count + 1);
    })({
      source: 'payload',
      value: 42,
    });
  }, [pulse]);

  const onMainDirectTap = useCallback(() => {
    setStatus('Waiting for background to main-thread echo');
    void runOnMainThread(echoOnMainThread)({
      source: 'background to main',
      value: backgroundSequence + 1,
    })
      .then((value) => {
        backgroundSequence += 1;
        setStatus('Background to main-thread check passed');
        setMainDirectResult(
          `${String(value)} -> background #${backgroundSequence}`,
        );
        setCompletedUpdates((count) => count + 1);
      })
      .catch((error: unknown) => {
        setStatus('Background to main-thread check failed');
        setMainDirectResult(`Error: ${formatError(error)}`);
      });
  }, [echoOnMainThread]);

  const onMainRoundTripTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    pulse(e);
    void runOnBackground((source: string) => {
      backgroundSequence += 1;
      const value = backgroundSequence;
      setStatus('Waiting for round trip to main thread');
      void runOnMainThread(echoOnMainThread)({ source, value })
        .then((mainValue) => {
          setStatus('Round trip check passed');
          setMainRoundTripResult(`${String(mainValue)} -> UI update #${value}`);
          setCompletedUpdates((count) => count + 1);
        })
        .catch((error: unknown) => {
          setStatus('Round trip check failed');
          setMainRoundTripResult(`Error: ${formatError(error)}`);
        });
    })('round trip');
  }, [echoOnMainThread, pulse]);

  const directPassed = directResult.startsWith(
    'tap event reached background #',
  );
  const nestedPassed = nestedResult.startsWith(
    'nested tap reached background #',
  );
  const burstPassed = burstResult.includes('a #')
    && burstResult.includes('b #')
    && burstResult.includes('c #');
  const payloadPassed = payloadResult.startsWith(
    'payload 42 reached background #',
  );
  const mainDirectPassed = mainDirectResult.startsWith('background to main #');
  const mainRoundTripPassed = mainRoundTripResult.startsWith('round trip #');
  const exposurePassed = exposureResult.startsWith(
    `exposure-id ${EXPOSURE_ID_PREFIX}-`,
  ) && exposureResult.includes(' reached background #');
  const passedCount = Number(directPassed)
    + Number(nestedPassed)
    + Number(burstPassed)
    + Number(payloadPassed)
    + Number(mainDirectPassed)
    + Number(mainRoundTripPassed)
    + Number(exposurePassed);
  const allPassed = passedCount === 7;

  return (
    <scroll-view
      scroll-y
      className='Page'
      exposure-id={`${EXPOSURE_ID_PREFIX}-${exposureRun}`}
      exposure-scene='react-et-mtf'
    >
      <view className='Header'>
        <text className='Title'>ET main-thread smoke</text>
        <text className='Subtitle'>
          Event, GlobalEventEmitter, background, and main-thread function checks
        </text>
      </view>

      <view className={allPassed ? 'Summary Summary--pass' : 'Summary'}>
        <view className='SummaryColumn'>
          <text className='SummaryLabel'>Overall</text>
          <text className='SummaryValue'>{`${passedCount} / 7 passed`}</text>
        </view>
        <view className='SummaryColumn'>
          <text className='SummaryLabel'>Last result</text>
          <text className='SummaryValue SummaryValue--small'>{status}</text>
        </view>
        <view className='SummaryColumn SummaryColumn--narrow'>
          <text className='SummaryLabel'>Updates</text>
          <text className='SummaryValue'>{String(completedUpdates)}</text>
        </view>
      </view>

      <view className='CheckList'>
        <view
          className={checkCardClass(directPassed)}
          main-thread:bindtap={onDirectTap}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>Main-thread event to background</text>
            <text className={checkBadgeClass(directPassed)}>
              {checkBadgeText(directPassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected: a tap handled on the main thread updates from background.
          </text>
          <text className='CheckActual'>Actual: {directResult}</text>
        </view>

        <view
          className={checkCardClass(nestedPassed)}
          main-thread:bindtap={onNestedTap}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>Nested background call</text>
            <text className={checkBadgeClass(nestedPassed)}>
              {checkBadgeText(nestedPassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected: a main-thread function can start another background call.
          </text>
          <text className='CheckActual'>Actual: {nestedResult}</text>
        </view>

        <view
          className={checkCardClass(burstPassed)}
          main-thread:bindtap={onBurstTap}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>Three background calls</text>
            <text className={checkBadgeClass(burstPassed)}>
              {checkBadgeText(burstPassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected: one event delivers background calls a, b, and c.
          </text>
          <text className='CheckActual CheckActual--small'>
            Actual: {burstResult}
          </text>
        </view>

        <view
          className={checkCardClass(payloadPassed)}
          main-thread:bindtap={onPayloadTap}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>Object payload to background</text>
            <text className={checkBadgeClass(payloadPassed)}>
              {checkBadgeText(payloadPassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected: source=payload and value=42 survive transport.
          </text>
          <text className='CheckActual'>Actual: {payloadResult}</text>
        </view>

        <view
          className={checkCardClass(exposurePassed)}
          bindtap={onExposureRun}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>
              Exposure event to GlobalEventEmitter
            </text>
            <text className={checkBadgeClass(exposurePassed)}>
              {checkBadgeText(exposurePassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected on SDK 4.2+: tap RUN to assign a new exposure-id and
            receive exposure event on GlobalEventEmitter.
          </text>
          <text className='CheckActual CheckActual--small'>
            Actual: {exposureResult}
          </text>
        </view>

        <view
          className={checkCardClass(mainDirectPassed)}
          bindtap={onMainDirectTap}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>Background to main thread</text>
            <text className={checkBadgeClass(mainDirectPassed)}>
              {checkBadgeText(mainDirectPassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected: background waits for a main-thread echo.
          </text>
          <text className='CheckActual CheckActual--small'>
            Actual: {mainDirectResult}
          </text>
        </view>

        <view
          className={checkCardClass(mainRoundTripPassed)}
          main-thread:bindtap={onMainRoundTripTap}
        >
          <view className='CheckHeader'>
            <text className='CheckTitle'>Main to background to main</text>
            <text className={checkBadgeClass(mainRoundTripPassed)}>
              {checkBadgeText(mainRoundTripPassed)}
            </text>
          </view>
          <text className='CheckExpected'>
            Expected: main event enters background, then calls main thread.
          </text>
          <text className='CheckActual CheckActual--small'>
            Actual: {mainRoundTripResult}
          </text>
        </view>
      </view>
    </scroll-view>
  );
}

import {
  runOnBackground,
  runOnMainThread,
  useCallback,
  useEffect,
  useMainThreadRef,
  useState,
} from '@lynx-js/react';
import type { MainThreadRef } from '@lynx-js/react';
import type { MainThread } from '@lynx-js/types';

import './App.css';

const NOT_RUN = 'Not run';
const TOTAL_CHECKS = 9;
const LIST_ITEMS = Array.from({ length: 18 }, (_, index) => ({
  id: `row-${index}`,
  title: `Row ${index}`,
}));

type ListItem = typeof LIST_ITEMS[number];
type CallbackRefName = 'A' | 'B';
type CallbackLifecyclePhase = 'idle' | 'replace' | 'unmount';
type CallbackLifecycleStep =
  | 'ready'
  | 'marking-replace'
  | 'replacing'
  | 'unmount-ready'
  | 'marking-unmount'
  | 'unmounting'
  | 'complete';
type ListLifecycleStep =
  | 'idle'
  | 'marking-start'
  | 'ready'
  | 'marking-forward'
  | 'forward-pending'
  | 'forward'
  | 'return-ready'
  | 'marking-return'
  | 'return-pending'
  | 'return'
  | 'error'
  | 'complete';
type ListLifecyclePhase =
  | 'idle'
  | 'ready'
  | 'forward-pending'
  | 'forward'
  | 'return-pending'
  | 'return'
  | 'complete';

interface ListLifecycleTracker {
  phase: ListLifecyclePhase;
  attachedItemIds: Record<string, boolean>;
  forwardBaselineItemIds: Record<string, boolean>;
  forwardDetachedItemIds: Record<string, boolean>;
  returnTargetItemId: string | null;
}

interface ListRefReport {
  itemId: string;
  mounted: boolean;
  phase: ListLifecyclePhase;
  returnTargetItemId: string | null;
  verified: boolean;
}

interface ListReturnConfirmation {
  targetItemId: string | null;
  verified: boolean;
}

let backgroundSequence = 0;
let callbackLifecycleStep: CallbackLifecycleStep = 'ready';
let callbackReplacementACleaned = false;
let callbackReplacementBMounted = false;
let listLifecycleStep: ListLifecycleStep = 'idle';
const attachedListItemIds = new Set<string>();
const forwardScrollDetachedItemIds = new Set<string>();

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

function CallbackRefTarget({
  callbackName,
  lifecyclePhaseRef,
  onReport,
}: {
  callbackName: CallbackRefName;
  lifecyclePhaseRef: MainThreadRef<CallbackLifecyclePhase>;
  onReport: (
    callbackName: CallbackRefName,
    mounted: boolean,
    phase: CallbackLifecyclePhase,
  ) => void;
}) {
  const targetRef = useCallback((element: MainThread.Element | null) => {
    'main thread';
    const phase = lifecyclePhaseRef.current;
    void runOnBackground((
      name: CallbackRefName,
      mounted: boolean,
      callbackPhase: CallbackLifecyclePhase,
    ) => {
      onReport(name, mounted, callbackPhase);
    })(callbackName, element !== null, phase);
  }, [callbackName, lifecyclePhaseRef, onReport]);

  return (
    <view
      className='RefTarget RefTarget--callback'
      main-thread:ref={targetRef}
    >
      <text className='RefTargetText'>callback {callbackName} target</text>
    </view>
  );
}

function SmokeListRow({
  item,
  lifecycleRef,
  onReport,
}: {
  item: ListItem;
  lifecycleRef: MainThreadRef<ListLifecycleTracker>;
  onReport: (report: ListRefReport) => void;
}) {
  const reportRef = useCallback((element: MainThread.Element | null) => {
    'main thread';
    const tracker = lifecycleRef.current;
    const mounted = element !== null;
    const phase = tracker.phase;
    let verified = false;
    if (mounted) {
      tracker.attachedItemIds[item.id] = true;
      if (phase === 'forward-pending' || phase === 'forward') {
        delete tracker.forwardDetachedItemIds[item.id];
      } else if (
        phase === 'return'
        && tracker.returnTargetItemId === item.id
      ) {
        tracker.phase = 'complete';
        verified = true;
      }
    } else {
      delete tracker.attachedItemIds[item.id];
      if (
        (phase === 'forward-pending' || phase === 'forward')
        && tracker.forwardBaselineItemIds[item.id]
      ) {
        tracker.forwardDetachedItemIds[item.id] = true;
      }
    }
    const report: ListRefReport = {
      itemId: item.id,
      mounted,
      phase,
      returnTargetItemId: tracker.returnTargetItemId,
      verified,
    };
    void runOnBackground((value: ListRefReport) => {
      onReport(value);
    })(report);
  }, [item.id, lifecycleRef, onReport]);

  return (
    <list-item item-key={item.id}>
      <view
        className='SmokeListItem'
        main-thread:ref={reportRef}
      >
        <text className='SmokeListItemTitle'>{item.title}</text>
        <text className='SmokeListItemMeta'>{item.id}</text>
      </view>
    </list-item>
  );
}

export function App() {
  const [status, setStatus] = useState('Ready');
  const [directResult, setDirectResult] = useState(NOT_RUN);
  const [nestedResult, setNestedResult] = useState(NOT_RUN);
  const [burstResult, setBurstResult] = useState(NOT_RUN);
  const [payloadResult, setPayloadResult] = useState(NOT_RUN);
  const [mainDirectResult, setMainDirectResult] = useState(NOT_RUN);
  const [mainRoundTripResult, setMainRoundTripResult] = useState(NOT_RUN);
  const [objectRefResult, setObjectRefResult] = useState(NOT_RUN);
  const [callbackRefResult, setCallbackRefResult] = useState(NOT_RUN);
  const [callbackVersion, setCallbackVersion] = useState<CallbackRefName>('A');
  const [callbackStep, setCallbackStep] = useState<CallbackLifecycleStep>(
    'ready',
  );
  const [callbackACleanupCount, setCallbackACleanupCount] = useState(0);
  const [callbackBMountCount, setCallbackBMountCount] = useState(0);
  const [callbackBCleanupCount, setCallbackBCleanupCount] = useState(0);
  const [showCallbackTarget, setShowCallbackTarget] = useState(true);
  const [listRefResult, setListRefResult] = useState(NOT_RUN);
  const [listAttachedCount, setListAttachedCount] = useState(0);
  const [listForwardDetachedCount, setListForwardDetachedCount] = useState(0);
  const [listVerifiedItemId, setListVerifiedItemId] = useState<string | null>(
    null,
  );
  const [listStep, setListStep] = useState<ListLifecycleStep>('idle');
  const [showListTest, setShowListTest] = useState(false);
  const [completedUpdates, setCompletedUpdates] = useState(0);
  const objectTargetRef = useMainThreadRef<MainThread.Element>(null);
  const callbackLifecyclePhaseRef = useMainThreadRef<CallbackLifecyclePhase>(
    'idle',
  );
  const listLifecycleRef = useMainThreadRef<ListLifecycleTracker>({
    phase: 'idle',
    attachedItemIds: {},
    forwardBaselineItemIds: {},
    forwardDetachedItemIds: {},
    returnTargetItemId: null,
  });

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

  const onObjectRefTap = useCallback((e: MainThread.TouchEvent) => {
    'main thread';
    pulse(e);
    const target = objectTargetRef.current;
    if (target) {
      target.animate([
        { opacity: 1 },
        { opacity: 0.55 },
        { opacity: 1 },
      ], {
        duration: 220,
        iterations: 1,
      });
    }
    void runOnBackground((hasTarget: boolean) => {
      backgroundSequence += 1;
      setStatus(
        hasTarget ? 'Object ref check passed' : 'Object ref check failed',
      );
      setObjectRefResult(
        hasTarget
          ? `object ref reached native element #${backgroundSequence}`
          : 'object ref current is null',
      );
      if (hasTarget) {
        setCompletedUpdates((count) => count + 1);
      }
    })(target !== null);
  }, [objectTargetRef, pulse]);

  const setCallbackLifecyclePhase = useCallback(
    (phase: CallbackLifecyclePhase) => {
      'main thread';
      callbackLifecyclePhaseRef.current = phase;
    },
    [callbackLifecyclePhaseRef],
  );

  const reportCallbackRef = useCallback((
    callbackName: CallbackRefName,
    mounted: boolean,
    phase: CallbackLifecyclePhase,
  ) => {
    backgroundSequence += 1;
    if (callbackName === 'A' && !mounted) {
      setCallbackACleanupCount((count) => count + 1);
    } else if (callbackName === 'B' && mounted) {
      setCallbackBMountCount((count) => count + 1);
    } else if (callbackName === 'B' && !mounted) {
      setCallbackBCleanupCount((count) => count + 1);
    }

    if (phase === 'replace') {
      if (callbackName === 'A' && !mounted) {
        callbackReplacementACleaned = true;
      } else if (callbackName === 'B' && mounted) {
        callbackReplacementBMounted = true;
      }
      if (
        callbackLifecycleStep === 'replacing'
        && callbackReplacementACleaned
        && callbackReplacementBMounted
      ) {
        callbackLifecycleStep = 'unmount-ready';
        setCallbackStep('unmount-ready');
        setStatus('Callback replacement passed');
        setCallbackRefResult(
          'callback A cleaned and callback B mounted on the same target',
        );
      }
    } else if (
      phase === 'unmount'
      && callbackName === 'B'
      && !mounted
      && callbackLifecycleStep === 'unmounting'
    ) {
      callbackLifecycleStep = 'complete';
      setCallbackStep('complete');
      setStatus('Callback replacement and unmount passed');
      setCallbackRefResult(
        'callback A cleaned on replacement; callback B cleaned on unmount',
      );
    } else if (phase === 'idle' && callbackName === 'A' && mounted) {
      setStatus('Callback A mounted');
      setCallbackRefResult(`callback A mounted #${backgroundSequence}`);
    }
    setCompletedUpdates((count) => count + 1);
  }, []);

  const onAdvanceCallbackRef = useCallback(() => {
    if (callbackLifecycleStep === 'ready') {
      callbackLifecycleStep = 'marking-replace';
      callbackReplacementACleaned = false;
      callbackReplacementBMounted = false;
      setCallbackStep('marking-replace');
      setStatus('Preparing callback replacement');
      void runOnMainThread(setCallbackLifecyclePhase)('replace')
        .then(() => {
          callbackLifecycleStep = 'replacing';
          setCallbackStep('replacing');
          setCallbackRefResult('Replacing callback A with callback B');
          setCallbackVersion('B');
        })
        .catch((error: unknown) => {
          callbackLifecycleStep = 'ready';
          setCallbackStep('ready');
          setStatus('Callback replacement setup failed');
          setCallbackRefResult(`Error: ${formatError(error)}`);
        });
    } else if (callbackLifecycleStep === 'unmount-ready') {
      callbackLifecycleStep = 'marking-unmount';
      setCallbackStep('marking-unmount');
      setStatus('Preparing callback unmount');
      void runOnMainThread(setCallbackLifecyclePhase)('unmount')
        .then(() => {
          callbackLifecycleStep = 'unmounting';
          setCallbackStep('unmounting');
          setCallbackRefResult('Removing the callback B target');
          setShowCallbackTarget(false);
        })
        .catch((error: unknown) => {
          callbackLifecycleStep = 'unmount-ready';
          setCallbackStep('unmount-ready');
          setStatus('Callback unmount setup failed');
          setCallbackRefResult(`Error: ${formatError(error)}`);
        });
    }
  }, [setCallbackLifecyclePhase]);

  const resetListLifecycle = useCallback(() => {
    'main thread';
    listLifecycleRef.current = {
      phase: 'ready',
      attachedItemIds: {},
      forwardBaselineItemIds: {},
      forwardDetachedItemIds: {},
      returnTargetItemId: null,
    };
  }, [listLifecycleRef]);

  const beginListForward = useCallback(() => {
    'main thread';
    const tracker = listLifecycleRef.current;
    const baselineItemIds: Record<string, boolean> = {};
    let attachedCount = 0;
    for (const itemId in tracker.attachedItemIds) {
      baselineItemIds[itemId] = true;
      attachedCount += 1;
    }
    if (attachedCount === 0) {
      return 0;
    }
    tracker.phase = 'forward-pending';
    tracker.forwardBaselineItemIds = baselineItemIds;
    tracker.forwardDetachedItemIds = {};
    tracker.returnTargetItemId = null;
    return attachedCount;
  }, [listLifecycleRef]);

  const confirmListForward = useCallback((): number => {
    'main thread';
    const tracker = listLifecycleRef.current;
    if (tracker.phase !== 'forward-pending') {
      return -1;
    }
    tracker.phase = 'forward';
    let detachedCount = 0;
    for (const itemId in tracker.forwardDetachedItemIds) {
      if (!tracker.attachedItemIds[itemId]) {
        detachedCount += 1;
      }
    }
    return detachedCount;
  }, [listLifecycleRef]);

  const cancelListForward = useCallback(() => {
    'main thread';
    const tracker = listLifecycleRef.current;
    if (tracker.phase === 'forward-pending') {
      tracker.phase = 'ready';
      tracker.forwardBaselineItemIds = {};
      tracker.forwardDetachedItemIds = {};
      tracker.returnTargetItemId = null;
    }
  }, [listLifecycleRef]);

  const beginListReturn = useCallback((): string | null => {
    'main thread';
    const tracker = listLifecycleRef.current;
    for (const itemId in tracker.forwardDetachedItemIds) {
      if (!tracker.attachedItemIds[itemId]) {
        tracker.phase = 'return-pending';
        tracker.returnTargetItemId = itemId;
        return itemId;
      }
    }
    return null;
  }, [listLifecycleRef]);

  const confirmListReturn = useCallback((): ListReturnConfirmation => {
    'main thread';
    const tracker = listLifecycleRef.current;
    const targetItemId = tracker.returnTargetItemId;
    if (tracker.phase !== 'return-pending' || targetItemId === null) {
      return { targetItemId: null, verified: false };
    }
    if (tracker.attachedItemIds[targetItemId]) {
      tracker.phase = 'complete';
      return { targetItemId, verified: true };
    }
    tracker.phase = 'return';
    return { targetItemId, verified: false };
  }, [listLifecycleRef]);

  const cancelListReturn = useCallback(() => {
    'main thread';
    const tracker = listLifecycleRef.current;
    if (tracker.phase === 'return-pending') {
      tracker.phase = 'forward';
      tracker.returnTargetItemId = null;
    }
  }, [listLifecycleRef]);

  const reportListItemRef = useCallback((report: ListRefReport) => {
    backgroundSequence += 1;
    if (report.mounted) {
      attachedListItemIds.add(report.itemId);
    } else {
      attachedListItemIds.delete(report.itemId);
    }

    if (
      report.verified
      && listLifecycleStep !== 'complete'
      && listLifecycleStep !== 'error'
    ) {
      listLifecycleStep = 'complete';
      setListStep('complete');
      setListVerifiedItemId(report.itemId);
      setStatus('List holder cleanup and reattach passed');
      setListRefResult(
        `${report.itemId} cleaned after forward scroll and reattached after return`,
      );
    } else if (
      listLifecycleStep !== 'complete'
      && listLifecycleStep !== 'error'
    ) {
      if (
        report.phase === 'forward-pending'
        || report.phase === 'forward'
      ) {
        if (report.mounted) {
          forwardScrollDetachedItemIds.delete(report.itemId);
        } else {
          forwardScrollDetachedItemIds.add(report.itemId);
        }
        setListForwardDetachedCount(forwardScrollDetachedItemIds.size);
        if (
          !report.mounted
          && report.phase === 'forward'
          && listLifecycleStep === 'forward'
        ) {
          listLifecycleStep = 'return-ready';
          setListStep('return-ready');
          setStatus('List holder cleanup observed; return to row 0');
          setListRefResult(
            `${report.itemId} holder cleaned after forward scroll`,
          );
        }
      } else if (report.phase === 'ready') {
        setStatus(
          report.mounted
            ? 'List item holder attached'
            : 'List item holder cleaned',
        );
        setListRefResult(
          `${report.itemId} holder ${
            report.mounted ? 'attached' : 'cleaned'
          } #${backgroundSequence}`,
        );
      } else if (report.phase === 'return' && report.returnTargetItemId) {
        setListRefResult(
          `Waiting for ${report.returnTargetItemId} to reattach`,
        );
      }
    }
    setListAttachedCount(attachedListItemIds.size);
    setCompletedUpdates((count) => count + 1);
  }, []);

  const onStartListTest = useCallback(() => {
    if (listLifecycleStep !== 'idle') {
      return;
    }
    attachedListItemIds.clear();
    forwardScrollDetachedItemIds.clear();
    listLifecycleStep = 'marking-start';
    setListAttachedCount(0);
    setListForwardDetachedCount(0);
    setListVerifiedItemId(null);
    setListRefResult('Preparing native holder tracking');
    setListStep('marking-start');
    setStatus('Preparing list holder lifecycle check');
    void runOnMainThread(resetListLifecycle)()
      .then(() => {
        listLifecycleStep = 'ready';
        setListRefResult('Waiting for native holder attachments');
        setListStep('ready');
        setShowListTest(true);
      })
      .catch((error: unknown) => {
        listLifecycleStep = 'idle';
        setListStep('idle');
        setStatus('List holder tracking setup failed');
        setListRefResult(`Error: ${formatError(error)}`);
      });
  }, [resetListLifecycle]);

  const onScrollList = useCallback(() => {
    if (listLifecycleStep !== 'ready') {
      return;
    }
    listLifecycleStep = 'marking-forward';
    setListStep('marking-forward');
    setStatus('Preparing forward list scroll');
    void runOnMainThread(beginListForward)()
      .then((attachedCount) => {
        if (attachedCount === 0) {
          listLifecycleStep = 'ready';
          setListStep('ready');
          setStatus('Waiting for list holders to attach');
          return;
        }
        forwardScrollDetachedItemIds.clear();
        listLifecycleStep = 'forward-pending';
        setListForwardDetachedCount(0);
        setListVerifiedItemId(null);
        setListRefResult('Requesting scroll to row 12');
        setListStep('forward-pending');
        lynx.createSelectorQuery()
          .select('.SmokeList')
          .invoke({
            method: 'scrollToPosition',
            params: { position: 12 },
            success: () => {
              void runOnMainThread(confirmListForward)().then(
                (value) => {
                  const detachedCount = value as number;
                  if (detachedCount < 0 || listLifecycleStep === 'complete') {
                    return;
                  }
                  if (detachedCount > 0) {
                    listLifecycleStep = 'return-ready';
                    setListStep('return-ready');
                    setStatus('List holder cleanup observed; return to row 0');
                  } else {
                    listLifecycleStep = 'forward';
                    setListStep('forward');
                    setStatus(
                      'Forward scroll accepted; waiting for holder cleanup',
                    );
                  }
                  setListRefResult(
                    'Scrolled to row 12; waiting for holder cleanup',
                  );
                },
              ).catch((error: unknown) => {
                listLifecycleStep = 'error';
                setListStep('error');
                setStatus('List forward confirmation failed');
                setListRefResult(`Error: ${formatError(error)}`);
              });
            },
            fail: ({ code }) => {
              void runOnMainThread(cancelListForward)().then(() => {
                listLifecycleStep = 'ready';
                setListStep('ready');
                setStatus('List forward scroll failed; ready to retry');
                setListRefResult(
                  `scrollToPosition(12) failed with code ${code}`,
                );
              }).catch((error: unknown) => {
                listLifecycleStep = 'error';
                setListStep('error');
                setStatus('List forward cancellation failed');
                setListRefResult(
                  `scrollToPosition(12) failed with code ${code}; cancel error: ${
                    formatError(error)
                  }`,
                );
              });
            },
          })
          .exec();
      })
      .catch((error: unknown) => {
        listLifecycleStep = 'error';
        setListStep('error');
        setStatus('List forward phase setup failed');
        setListRefResult(`Error: ${formatError(error)}`);
      });
  }, [beginListForward, cancelListForward, confirmListForward]);

  const onReturnList = useCallback(() => {
    if (listLifecycleStep !== 'return-ready') {
      return;
    }
    listLifecycleStep = 'marking-return';
    setListStep('marking-return');
    setStatus('Locking the cleaned holder for return');
    void runOnMainThread(beginListReturn)()
      .then((targetItemId) => {
        if (typeof targetItemId !== 'string') {
          listLifecycleStep = 'forward';
          setListStep('forward');
          setStatus('No cleaned holder is currently detached');
          setListRefResult(
            'Waiting for another holder cleanup before returning',
          );
          return;
        }
        listLifecycleStep = 'return-pending';
        setListRefResult(`Requesting return to row 0 for ${targetItemId}`);
        setListStep('return-pending');
        lynx.createSelectorQuery()
          .select('.SmokeList')
          .invoke({
            method: 'scrollToPosition',
            params: { position: 0 },
            success: () => {
              void runOnMainThread(confirmListReturn)().then((value) => {
                const confirmation = value as ListReturnConfirmation;
                if (
                  confirmation.targetItemId === null
                  || listLifecycleStep === 'complete'
                ) {
                  return;
                }
                if (confirmation.verified) {
                  listLifecycleStep = 'complete';
                  setListStep('complete');
                  setListVerifiedItemId(confirmation.targetItemId);
                  setStatus('List holder cleanup and reattach passed');
                  setListRefResult(
                    `${confirmation.targetItemId} cleaned after forward scroll and reattached after return`,
                  );
                } else {
                  listLifecycleStep = 'return';
                  setListStep('return');
                  setListRefResult(
                    `Returned to row 0; waiting for ${confirmation.targetItemId}`,
                  );
                }
              }).catch((error: unknown) => {
                listLifecycleStep = 'error';
                setListStep('error');
                setStatus('List return confirmation failed');
                setListRefResult(`Error: ${formatError(error)}`);
              });
            },
            fail: ({ code }) => {
              void runOnMainThread(cancelListReturn)().then(() => {
                listLifecycleStep = 'return-ready';
                setListStep('return-ready');
                setStatus('List return scroll failed; ready to retry');
                setListRefResult(
                  `scrollToPosition(0) failed with code ${code}`,
                );
              }).catch((error: unknown) => {
                listLifecycleStep = 'error';
                setListStep('error');
                setStatus('List return cancellation failed');
                setListRefResult(
                  `scrollToPosition(0) failed with code ${code}; cancel error: ${
                    formatError(error)
                  }`,
                );
              });
            },
          })
          .exec();
      })
      .catch((error: unknown) => {
        listLifecycleStep = 'error';
        setListStep('error');
        setStatus('List return phase setup failed');
        setListRefResult(`Error: ${formatError(error)}`);
      });
  }, [beginListReturn, cancelListReturn, confirmListReturn]);

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
  const objectRefPassed = objectRefResult.startsWith(
    'object ref reached native element #',
  );
  const callbackRefPassed = callbackStep === 'complete';
  const listRefPassed = listVerifiedItemId !== null;
  const passedCount = Number(directPassed)
    + Number(nestedPassed)
    + Number(burstPassed)
    + Number(payloadPassed)
    + Number(mainDirectPassed)
    + Number(mainRoundTripPassed)
    + Number(objectRefPassed)
    + Number(callbackRefPassed)
    + Number(listRefPassed);
  const allPassed = passedCount === TOTAL_CHECKS;
  let callbackExpected =
    'Tap once to replace callback A with B on the same element.';
  let callbackActionHandler: (() => void) | undefined = onAdvanceCallbackRef;
  if (callbackStep === 'marking-replace' || callbackStep === 'replacing') {
    callbackExpected = 'Waiting for callback A cleanup and callback B mount.';
    callbackActionHandler = undefined;
  } else if (callbackStep === 'unmount-ready') {
    callbackExpected =
      'Replacement passed: tap again to remove the callback B target.';
  } else if (
    callbackStep === 'marking-unmount'
    || callbackStep === 'unmounting'
  ) {
    callbackExpected = 'Waiting for callback B cleanup after target removal.';
    callbackActionHandler = undefined;
  } else if (callbackStep === 'complete') {
    callbackExpected =
      'Passed: callback A cleaned on replacement and callback B cleaned on unmount.';
    callbackActionHandler = undefined;
  }
  let listExpected =
    'Tap this card to mount the list and start the holder lifecycle check.';
  let listActionText = 'Waiting for holder cleanup';
  let listActionHandler: (() => void) | undefined;
  if (showListTest) {
    listExpected =
      'Scroll to row 12 and wait for a currently attached holder to clean up.';
  }
  if (listStep === 'ready') {
    listActionText = 'Scroll to row 12';
    listActionHandler = onScrollList;
  } else if (
    listStep === 'marking-forward'
    || listStep === 'forward-pending'
  ) {
    listActionText = 'Starting forward scroll';
  } else if (listStep === 'return-ready') {
    listExpected =
      'Return to row 0 and verify that a cleaned holder attaches again.';
    listActionText = 'Return to row 0';
    listActionHandler = onReturnList;
  } else if (
    listStep === 'marking-return'
    || listStep === 'return-pending'
  ) {
    listExpected =
      'Return to row 0 and verify that a cleaned holder attaches again.';
    listActionText = 'Starting return scroll';
  } else if (listStep === 'return') {
    listExpected =
      'Return to row 0 and verify that a cleaned holder attaches again.';
    listActionText = 'Waiting for holder reattach';
  } else if (listStep === 'error') {
    listExpected = 'The holder lifecycle result is indeterminate.';
    listActionText = 'Reload the page to retry';
  } else if (listStep === 'complete') {
    listExpected =
      'Passed: one holder cleaned up after the forward scroll and reattached after returning.';
    listActionText = `Verified ${listVerifiedItemId}`;
  }
  const listActionClass = listActionHandler
    ? 'ListScrollAction'
    : 'ListScrollAction ListScrollAction--disabled';

  return (
    <view className='Page'>
      <view className='Header'>
        <text className='Title'>ET main-thread smoke</text>
        <text className='Subtitle'>
          Event, background, main-thread function, and ref checks
        </text>
      </view>

      <view className={allPassed ? 'Summary Summary--pass' : 'Summary'}>
        <view className='SummaryColumn'>
          <text className='SummaryLabel'>Overall</text>
          <text className='SummaryValue'>
            {`${passedCount} / ${TOTAL_CHECKS} passed`}
          </text>
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

      <scroll-view className='CheckList' scroll-orientation='vertical'>
        <view className='CheckListContent'>
          <view
            className={checkCardClass(directPassed)}
            main-thread:bindtap={onDirectTap}
          >
            <view className='CheckHeader'>
              <text className='CheckTitle'>
                Main-thread event to background
              </text>
              <text className={checkBadgeClass(directPassed)}>
                {checkBadgeText(directPassed)}
              </text>
            </view>
            <text className='CheckExpected'>
              Expected: a tap handled on the main thread updates from
              background.
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
              Expected: a main-thread function can start another background
              call.
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

          <view
            className={checkCardClass(objectRefPassed)}
            main-thread:bindtap={onObjectRefTap}
          >
            <view className='CheckHeader'>
              <text className='CheckTitle'>Object main-thread ref</text>
              <text className={checkBadgeClass(objectRefPassed)}>
                {checkBadgeText(objectRefPassed)}
              </text>
            </view>
            <view className='RefTarget' main-thread:ref={objectTargetRef}>
              <text className='RefTargetText'>object ref target</text>
            </view>
            <text className='CheckExpected'>
              Tap this card: the target should animate and report a real
              element.
            </text>
            <text className='CheckActual'>Actual: {objectRefResult}</text>
          </view>

          <view
            className={checkCardClass(callbackRefPassed)}
            bindtap={callbackActionHandler}
          >
            <view className='CheckHeader'>
              <text className='CheckTitle'>Callback ref cleanup</text>
              <text className={checkBadgeClass(callbackRefPassed)}>
                {checkBadgeText(callbackRefPassed)}
              </text>
            </view>
            {showCallbackTarget
              ? (
                <CallbackRefTarget
                  callbackName={callbackVersion}
                  lifecyclePhaseRef={callbackLifecyclePhaseRef}
                  onReport={reportCallbackRef}
                />
              )
              : (
                <view className='RefPlaceholder'>
                  <text className='RefPlaceholderText'>
                    callback B target removed
                  </text>
                </view>
              )}
            <text className='CheckExpected'>
              {callbackExpected}
            </text>
            <text className='CheckActual CheckActual--small'>
              Actual: {callbackRefResult} | A cleanup{' '}
              {String(callbackACleanupCount)} | B mount{' '}
              {String(callbackBMountCount)} | B cleanup{' '}
              {String(callbackBCleanupCount)}
            </text>
          </view>

          <view
            className={checkCardClass(listRefPassed)}
            bindtap={showListTest ? undefined : onStartListTest}
          >
            <view className='CheckHeader'>
              <text className='CheckTitle'>List item ref lifecycle</text>
              <text className={checkBadgeClass(listRefPassed)}>
                {checkBadgeText(listRefPassed)}
              </text>
            </view>
            <text className='CheckExpected'>
              {listExpected}
            </text>
            <text className='CheckActual CheckActual--small'>
              Actual: {listRefResult} | attached {String(listAttachedCount)}
              {' '}
              | forward cleanup {String(listForwardDetachedCount)}
            </text>
            {showListTest
              ? (
                <>
                  <view
                    className={listActionClass}
                    bindtap={listActionHandler}
                  >
                    <text className='ListScrollActionText'>
                      {listActionText}
                    </text>
                  </view>
                  <list
                    className='SmokeList'
                    list-type='single'
                  >
                    {LIST_ITEMS.map((item) => (
                      <SmokeListRow
                        item={item}
                        key={item.id}
                        lifecycleRef={listLifecycleRef}
                        onReport={reportListItemRef}
                      />
                    ))}
                  </list>
                </>
              )
              : (
                <view className='RefPlaceholder'>
                  <text className='RefPlaceholderText'>tap card to start</text>
                </view>
              )}
          </view>
        </view>
      </scroll-view>
    </view>
  );
}

import { runOnBackground, useMainThreadRef, useMemo } from '@lynx-js/react';

export interface SpreadMtsFixtureProps {
  mode?: 'normal' | 'typed-page' | 'typed-list';
  show?: boolean;
  label?: string;
  cardId?: string;
  enableEvents?: boolean;
  enableGesture?: boolean;
  refKind?: 'none' | 'object' | 'callback';
  secondSpreadMode?: 'omit' | 'override-events-gesture-ref' | 'null-ref';
  onTapReport?: (source: string, label: string, count: number) => string;
  onMoveReport?: (label: string, count: number) => string;
  onGestureReport?: (source: string, label: string, count: number) => string;
  onRefReport?: (phase: string, tag: string) => void;
}

export function App({
  mode = 'normal',
  show = true,
  label = 'first',
  cardId = 'card-1',
  enableEvents = true,
  enableGesture = true,
  refKind = 'object',
  secondSpreadMode = 'omit',
  onTapReport = () => '',
  onMoveReport = () => '',
  onGestureReport = () => '',
  onRefReport = () => {},
}: SpreadMtsFixtureProps) {
  const countRef = useMainThreadRef(0);
  const rootElRef = useMainThreadRef<unknown>(null);
  const nestedElRef = useMainThreadRef<unknown>(null);

  const primaryTap = useMemo(() => {
    const fn = () => {
      'main thread';
      countRef.current += 1;
      const hasEl = rootElRef.current != null ? 'with-ref' : 'no-ref';
      return runOnBackground(onTapReport)(`primary:${hasEl}`, label, countRef.current);
    };
    return fn;
  }, [label]);

  const secondaryTap = () => {
    'main thread';
    countRef.current += 10;
    return runOnBackground(onTapReport)('secondary', label, countRef.current);
  };

  const handleCatchMove = useMemo(() => {
    const fn = () => {
      'main thread';
      countRef.current += 1;
      return runOnBackground(onMoveReport)(label, countRef.current);
    };
    return fn;
  }, [label]);

  const primaryGestureUpdate = useMemo(() => {
    const fn = () => {
      'main thread';
      countRef.current += 1;
      return runOnBackground(onGestureReport)('primary-gesture', label, countRef.current);
    };
    return fn;
  }, [label]);

  const secondaryGestureUpdate = () => {
    'main thread';
    countRef.current += 100;
    return runOnBackground(onGestureReport)('secondary-gesture', label, countRef.current);
  };

  const primaryCallbackRef = useMemo(() => {
    const fn = (el: unknown) => {
      'main thread';
      rootElRef.current = el;
      void runOnBackground(onRefReport)(`mount:${label}`, el ? 'present' : 'null');
      return () => {
        'main thread';
        rootElRef.current = null;
        void runOnBackground(onRefReport)(`cleanup:${label}`, 'cleaned');
      };
    };
    return fn;
  }, [label]);

  const secondaryCallbackRef = (el: unknown) => {
    'main thread';
    rootElRef.current = el;
    void runOnBackground(onRefReport)(`mount-override:${label}`, el ? 'present' : 'null');
    return () => {
      'main thread';
      rootElRef.current = null;
      void runOnBackground(onRefReport)(`cleanup-override:${label}`, 'cleaned');
    };
  };

  const primaryGesture = useMemo(
    () =>
      enableGesture
        ? {
          __isGesture: true,
          id: 21,
          type: -1,
          gestures: [
            {
              __isGesture: true,
              id: 22,
              type: 0,
              config: { minDistance: 4 },
              callbacks: { onUpdate: primaryGestureUpdate },
            },
            {
              __isGesture: true,
              id: 23,
              type: 1,
              config: { taps: 1 },
              callbacks: { onBegin: primaryGestureUpdate },
            },
          ],
          callbacks: {},
        }
        : null,
    [enableGesture, primaryGestureUpdate],
  );

  const secondaryGesture = {
    __isGesture: true,
    id: 31,
    type: 0,
    config: { minDistance: 12 },
    callbacks: { onUpdate: secondaryGestureUpdate },
  };

  const firstSpread: Record<string, unknown> = {
    id: cardId,
    'main-thread:bindtap': enableEvents ? primaryTap : null,
    'main-thread:catchtouchmove': enableEvents ? handleCatchMove : false,
    'main-thread:gesture': primaryGesture,
  };
  if (refKind === 'object') {
    firstSpread['main-thread:ref'] = rootElRef;
  } else if (refKind === 'callback') {
    firstSpread['main-thread:ref'] = primaryCallbackRef;
  }

  if (mode === 'typed-page') {
    return (
      <page {...firstSpread}>
        <view id='inside-page' />
      </page>
    );
  }

  if (mode === 'typed-list') {
    return (
      <list {...firstSpread}>
        <list-item item-key='k1'>
          <view id='inside-list' />
        </list-item>
      </list>
    );
  }

  let secondSpread: Record<string, unknown> = { 'data-extra': 'ok' };
  if (secondSpreadMode === 'override-events-gesture-ref') {
    secondSpread = {
      'data-extra': 'override',
      'main-thread:bindtap': secondaryTap,
      'main-thread:gesture': secondaryGesture,
      'main-thread:ref': secondaryCallbackRef,
    };
  } else if (secondSpreadMode === 'null-ref') {
    secondSpread = {
      'data-extra': 'null-ref',
      'main-thread:ref': undefined,
    };
  }

  const nestedSpread: Record<string, unknown> = {
    id: `nested-${cardId}`,
    'main-thread:ref': nestedElRef,
  };

  if (!show) {
    return <view id='empty' />;
  }

  return (
    <view {...firstSpread} {...secondSpread}>
      <text {...nestedSpread}>Hello</text>
    </view>
  );
}

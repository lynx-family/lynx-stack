import { runOnBackground, useMainThreadRef, useMemo } from '@lynx-js/react';

export interface ListMtsItemSpec {
  key: string;
  hasChildRef?: boolean;
  useCallbackRef?: boolean;
}

export interface ListMtsFixtureProps {
  showList?: boolean;
  label?: string;
  listRefMode?: 'none' | 'object' | 'callback';
  enableListEvents?: boolean;
  enableListGesture?: boolean;
  items?: ListMtsItemSpec[];
  onListScrollReport?: (label: string, hasListEl: boolean, count: number) => string;
  onListGestureReport?: (label: string, count: number) => string;
  onListRefReport?: (phase: string, label: string) => void;
  onItemRefReport?: (phase: string, key: string, label: string) => void;
}

export function App({
  showList = true,
  label = 'v1',
  listRefMode = 'object',
  enableListEvents = true,
  enableListGesture = true,
  items = [
    { key: 'item-a', hasChildRef: true, useCallbackRef: true },
    { key: 'item-b', hasChildRef: true, useCallbackRef: false },
    { key: 'item-c', hasChildRef: false },
  ],
  onListScrollReport = () => '',
  onListGestureReport = () => '',
  onListRefReport = () => {},
  onItemRefReport = () => {},
}: ListMtsFixtureProps) {
  const scrollCountRef = useMainThreadRef(0);
  const listElRef = useMainThreadRef<unknown>(null);
  const itemAObjectRef = useMainThreadRef<unknown>(null);
  const itemBObjectRef = useMainThreadRef<unknown>(null);
  const itemCObjectRef = useMainThreadRef<unknown>(null);

  const handleListScroll = useMemo(() => {
    const fn = () => {
      'main thread';
      scrollCountRef.current += 1;
      return runOnBackground(onListScrollReport)(
        label,
        listElRef.current != null,
        scrollCountRef.current,
      );
    };
    return fn;
  }, [label]);

  const handleListGestureUpdate = useMemo(() => {
    const fn = () => {
      'main thread';
      scrollCountRef.current += 10;
      return runOnBackground(onListGestureReport)(label, scrollCountRef.current);
    };
    return fn;
  }, [label]);

  const listCallbackRef = useMemo(() => {
    const fn = (el: unknown) => {
      'main thread';
      listElRef.current = el;
      void runOnBackground(onListRefReport)('mount', label);
      return () => {
        'main thread';
        listElRef.current = null;
        void runOnBackground(onListRefReport)('cleanup', label);
      };
    };
    return fn;
  }, [label]);

  const itemACallbackRef = useMemo(() => {
    const fn = (el: { setAttribute?: (name: string, value: unknown) => void } | null) => {
      'main thread';
      if (el && typeof el.setAttribute === 'function') {
        el.setAttribute('data-mounted', 'item-a');
      }
      void runOnBackground(onItemRefReport)('mount', 'item-a', label);
      return () => {
        'main thread';
        void runOnBackground(onItemRefReport)('cleanup', 'item-a', label);
      };
    };
    return fn;
  }, [label]);

  const itemCCallbackRef = useMemo(() => {
    const fn = () => {
      'main thread';
      void runOnBackground(onItemRefReport)('mount', 'item-c', label);
      return () => {
        'main thread';
        void runOnBackground(onItemRefReport)('cleanup', 'item-c', label);
      };
    };
    return fn;
  }, [label]);

  const itemDCallbackRef = useMemo(() => {
    const fn = () => {
      'main thread';
      void runOnBackground(onItemRefReport)('mount', 'item-d', label);
      return () => {
        'main thread';
        void runOnBackground(onItemRefReport)('cleanup', 'item-d', label);
      };
    };
    return fn;
  }, [label]);

  const getCallbackRefForKey = (key: string) => {
    if (key === 'item-a') return itemACallbackRef;
    if (key === 'item-c') return itemCCallbackRef;
    return itemDCallbackRef;
  };

  const listGesture = useMemo(
    () =>
      enableListGesture
        ? {
          __isGesture: true,
          id: 41,
          type: 0,
          config: { minDistance: 6 },
          callbacks: { onUpdate: handleListGestureUpdate },
        }
        : null,
    [enableListGesture, handleListGestureUpdate],
  );

  const getObjectRefForKey = (key: string) => {
    if (key === 'item-a') return itemAObjectRef;
    if (key === 'item-b') return itemBObjectRef;
    return itemCObjectRef;
  };

  if (!showList) {
    return <view id='empty-shell' />;
  }

  return (
    <view id='shell'>
      <list
        id='feed-list'
        scroll-orientation='vertical'
        main-thread:bindscroll={enableListEvents ? handleListScroll : undefined}
        main-thread:gesture={listGesture}
        main-thread:ref={listRefMode === 'object'
          ? listElRef
          : listRefMode === 'callback'
          ? listCallbackRef
          : undefined}
      >
        {items.map(spec => {
          const itemSpread: Record<string, unknown> = { 'data-item': spec.key };
          if (spec.key === 'item-b' && spec.hasChildRef) {
            itemSpread['main-thread:ref'] = getObjectRefForKey(spec.key);
          }
          return (
            <list-item key={spec.key} item-key={spec.key} {...itemSpread}>
              {spec.hasChildRef && spec.key !== 'item-b'
                ? (
                  <view
                    id={`badge-${spec.key}`}
                    main-thread:ref={spec.useCallbackRef
                      ? getCallbackRefForKey(spec.key)
                      : getObjectRefForKey(spec.key)}
                  />
                )
                : null}
            </list-item>
          );
        })}
      </list>
    </view>
  );
}

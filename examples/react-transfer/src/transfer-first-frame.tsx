// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useLayoutEffect } from 'preact/hooks';

import {
  runOnBackground,
  runOnMainThread,
  useMainThreadRef,
  useRef,
  useState,
} from '@lynx-js/react';
import { TransferRegistry } from '@lynx-js/react/internal';

interface MotionValue {
  on(): void;
  set(value: number): void;
}

function report(phase: string) {
  'main thread';
  return phase;
}

let secondRender = false;
let bLayoutQueued = false;
let bUpdated = false;
let aRevision = 0;
let aLayoutRevision = -1;
let deliverA: (() => void) | undefined;
let deliverB: (() => void) | undefined;

function releaseFirstFrames() {
  if (secondRender && bLayoutQueued && deliverB) {
    const deliver = deliverB;
    deliverB = undefined;
    log('deliver B frame');
    deliver();
  }
  if (bUpdated && aLayoutRevision === aRevision && deliverA) {
    const deliver = deliverA;
    deliverA = undefined;
    log(`deliver A frame: ${aRevision}`);
    deliver();
  }
}

function log(message: string) {
  console.info(`[transfer-first-frame] ${message}`);
}

export function FirstFrameWorklet(props: Record<string, unknown>) {
  const name = typeof props['name'] === 'string' ? props['name'] : 'Transfer';
  const revision = typeof props['revision'] === 'number'
    ? props['revision']
    : 0;
  const motionValue = useMainThreadRef<MotionValue | null>(null);
  const requested = useRef(false);
  const requestedUpdate = useRef(false);
  const [early, setEarly] = useState('pending');
  const [late, setLate] = useState('not requested');
  const [renderCount, setRenderCount] = useState(0);

  function initialize() {
    'main thread';
    motionValue.current = {
      on() {
        console.info('[transfer-first-frame] subscribed');
      },
      set(value) {
        console.info('[transfer-first-frame] selected:', value);
      },
    };
  }

  function reportRead(action: string) {
    'background only';
    log(`${name} ${action} succeeded: ${revision}`);
  }

  function subscribe() {
    'main thread';
    motionValue.current!.on();
    void runOnBackground(reportRead)('subscribe');
  }

  function select() {
    'main thread';
    motionValue.current!.set(1);
    void runOnBackground(reportRead)('select');
  }

  if (__BACKGROUND__ && !requested.current) {
    requested.current = true;
    if (name === 'A') aRevision = revision;
    log(`${name} render 0 queued: ${revision}`);
    void runOnMainThread(initialize)().then(() => {
      log(`${name} render 0 ran: ${revision}`);
      setEarly('ran');
    });
  }

  if (
    __BACKGROUND__ && name === 'B' && early === 'ran'
    && !requestedUpdate.current
  ) {
    requestedUpdate.current = true;
    log('B update queued');
    void runOnMainThread<string, typeof report>(report)('B update').then(
      value => {
        log(`${value} ran`);
        bUpdated = true;
        releaseFirstFrames();
      },
    );
  }

  if (__BACKGROUND__ && name === 'A' && renderCount === 1 && !secondRender) {
    secondRender = true;
    log('A render 1 queued');
    void runOnMainThread<string, typeof report>(report)('A render 1').then(
      value => log(`${value} ran`),
    );
    setTimeout(releaseFirstFrames, 0);
  }

  useLayoutEffect(() => {
    log(`${name} layout queued: ${revision}`);
    void runOnMainThread<string, typeof report>(report)(
      `${name} layout: ${revision}`,
    ).then(value => log(`${value} ran`));
    if (name === 'A') {
      aLayoutRevision = revision;
      if (revision === 0) setRenderCount(1);
      setTimeout(releaseFirstFrames, 0);
    }
    if (name === 'B') {
      bLayoutQueued = true;
      setTimeout(releaseFirstFrames, 0);
    }
  }, [name, revision, setRenderCount]);

  return (
    <view style={{ padding: '16px' }}>
      <text>{name} · revision {revision} · render {renderCount}</text>
      <text>Early worklet: {early}</text>
      <text>Late worklet: {late}</text>
      <view style={{ padding: '12px' }} main-thread:bindtap={subscribe}>
        <text>Subscribe (.on)</text>
      </view>
      <view style={{ padding: '12px' }} main-thread:bindtap={select}>
        <text>Select tab (.set)</text>
      </view>
      <view
        style={{ padding: '12px', backgroundColor: '#e6efff' }}
        bindtap={() => {
          void runOnMainThread(report)('late').then(() => setLate('ran'));
        }}
      >
        <text>Run late worklet</text>
      </view>
    </view>
  );
}

if (__BACKGROUND__) {
  const getContext = lynx.getCoreContext.bind(lynx);
  const core = getContext();
  const names = new Map<string, string>();
  const add = core.addEventListener.bind(core);
  type Listener = Parameters<typeof core.addEventListener>[1];
  const listeners = new Map<Listener, Listener>();
  const context: typeof core = {
    ...core,
    addEventListener(type, listener) {
      if (type !== '__CreateTransfer' && type !== '__TransferFirstFrame') {
        add(type, listener);
        return;
      }
      const wrapped: typeof listener = event => {
        const data = (typeof event.data === 'string'
          ? JSON.parse(event.data)
          : event.data) as {
            transferId: string;
            initialProps?: { name: string };
          };
        if (type === '__CreateTransfer') {
          if (data.initialProps) {
            names.set(data.transferId, data.initialProps.name);
          }
        } else {
          const name = names.get(data.transferId);
          if (name === 'A' && (!bUpdated || aLayoutRevision !== aRevision)) {
            deliverA = () => listener(event);
            log('hold A frame');
            return;
          }
          if (name === 'B' && !bUpdated) {
            deliverB = () => listener(event);
            releaseFirstFrames();
            return;
          }
        }
        listener(event);
      };
      listeners.set(listener, wrapped);
      add(type, wrapped);
    },
    removeEventListener(type, listener) {
      core.removeEventListener(type, listeners.get(listener) ?? listener);
      listeners.delete(listener);
    },
  };
  lynx.getCoreContext = () => context;
  try {
    TransferRegistry.registerComponent(
      'FirstFrameWorklet',
      () => FirstFrameWorklet,
    );
  } finally {
    lynx.getCoreContext = getContext;
  }
} else {
  TransferRegistry.registerComponent(
    'FirstFrameWorklet',
    () => FirstFrameWorklet,
  );
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect } from 'preact/hooks';

import { runOnBackground, useState } from '@lynx-js/react';
import { TransferRegistry } from '@lynx-js/react/internal';

function log(message: string) {
  console.info(`[transfer-run-on-background] ${message}`);
}

// Held first frames by transfer ID.
const held = new Map<string, { name: string; deliver: () => void }>();

function deliverHeldFrames() {
  for (const [transferId, { name, deliver }] of held) {
    held.delete(transferId);
    log(`deliver ${name} frame`);
    deliver();
  }
}

export function FirstScreenRunOnBackground(props: Record<string, unknown>) {
  const name = typeof props['name'] === 'string' ? props['name'] : 'Transfer';
  const [phase, setPhase] = useState('first screen');
  const [calls, setCalls] = useState(0);

  useEffect(() => setPhase('hydrated'), [setPhase]);

  function onBackground(source: string) {
    'background only';
    log(`${name} runOnBackground ran: ${source}`);
    setCalls(count => count + 1);
  }

  function call() {
    'main thread';
    console.info(`[transfer-run-on-background] ${name} tap`);
    void runOnBackground(onBackground)('tap');
  }

  return (
    <view style={{ padding: '16px' }}>
      <text>{name} · {phase} · background calls {calls}</text>
      <view
        style={{ padding: '12px', backgroundColor: '#e6efff' }}
        main-thread:bindtap={call}
      >
        <text>{name}: call runOnBackground</text>
      </view>
      <view
        style={{ padding: '12px', backgroundColor: '#fff2d6' }}
        bindtap={deliverHeldFrames}
      >
        <text>{name}: deliver held frames</text>
      </view>
    </view>
  );
}

if (__BACKGROUND__) {
  // Holds the first frame of instances created with `"hold": true`, so they stay
  // on their main-thread first screen after other instances hydrate.
  const getContext = lynx.getCoreContext.bind(lynx);
  const core = getContext();
  const names = new Map<string, string>();
  const holds = new Set<string>();
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
            initialProps?: { name?: string; hold?: boolean };
          };
        if (type === '__CreateTransfer') {
          names.set(
            data.transferId,
            data.initialProps?.name ?? data.transferId,
          );
          if (data.initialProps?.hold) holds.add(data.transferId);
        } else if (holds.delete(data.transferId)) {
          const name = names.get(data.transferId)!;
          held.set(data.transferId, { name, deliver: () => listener(event) });
          log(`hold ${name} frame`);
          return;
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
      'FirstScreenRunOnBackground',
      () => FirstScreenRunOnBackground,
    );
  } finally {
    lynx.getCoreContext = getContext;
  }
} else {
  TransferRegistry.registerComponent(
    'FirstScreenRunOnBackground',
    () => FirstScreenRunOnBackground,
  );
}

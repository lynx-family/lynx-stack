// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from '@lynx-js/react';

/**
 * The pieces every permutation is built from.
 *
 * Each one carries a stable `id` and a distinct colour, so a screenshot says
 * which thread built what: skeletons are pale, main-thread content is blue,
 * background content is green, plain first-screen content is dark.
 *
 * The pieces the main thread can build carry a main-thread tap handler that
 * paints them orange. That handler is the instrument the whole matrix turns
 * on: it runs with the background thread held, so it proves the element was
 * really built here — and because it mutates the element directly rather than
 * through a snapshot, the paint survives hydration if and only if the
 * background *adopted* that element instead of replacing it.
 *
 * This module deliberately names no boundary. It is imported by every case,
 * including the no-boundary control, and the build detects the mode by
 * walking an entry's whole relative-import graph — a `<MainThread>` in here
 * would turn every case into a boundary case. The two fixtures that need one
 * inside deferred content keep it in a module of their own.
 */

const STAMP = '#f5a623';

const box = (color) => ({
  width: '240px',
  height: '30px',
  margin: '3px',
  backgroundColor: color,
});

function stamp(event) {
  'main thread';
  event.currentTarget.setStyleProperty('background-color', STAMP);
}

/** A *component* fallback: its body runs on the main thread. */
export function Skeleton({ id }) {
  const rows = [0, 1];
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row) => (
        <view
          key={row}
          id={`${id}-skeleton-${row}`}
          main-thread:bindtap={stamp}
          style={box('#c9d5e3')}
        />
      ))}
    </view>
  );
}

/** Deferred content: only the background thread ever renders this. */
export function Deferred({ id }) {
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view id={`${id}-deferred`} style={box('#2e8b57')} />
    </view>
  );
}

/**
 * Island content: a component with a main-thread event handler, so it is only
 * interactive on the first frame if the main thread really ran its body.
 */
export function Island({ id }) {
  return (
    <view style={{ display: 'flex', flexDirection: 'column' }}>
      <view
        id={`${id}-island`}
        main-thread:bindtap={stamp}
        style={box('#2f6fd0')}
      />
    </view>
  );
}

/** Ordinary first-screen content, outside any boundary. */
export function Header({ id }) {
  return <view id={`${id}-header`} style={box('#1a1a2e')} />;
}

/**
 * The hydration beacon. Effects only run on the background thread, so this
 * appears exactly once the background has rendered and handed over — a signal
 * every case has, including the ones whose two frames are otherwise
 * identical. It is a one-pixel view and the harness filters it out of every
 * comparison; it is there to be waited on, not looked at.
 */
export function BTReady({ id }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  return ready
    ? <view id={`${id}-bt-ready`} style={{ width: '1px', height: '1px' }} />
    : null;
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useLynx } from '@lynx-js/react';
import { useEffect, useState } from '@lynx-js/react';

import {
  getCount,
  increment,
  incrementLater,
  instanceId,
  subscribe,
} from './store.js';

export function Page(props: { name: string }): JSX.Element {
  const lynx = useLynx();
  const [count, setCount] = useState(getCount());
  const [pending, setPending] = useState(false);
  // The main thread has its own copy of the store, so read the shared instance
  // after mount, when the background thread owns the tree.
  const [sharedInstance, setSharedInstance] = useState('');

  useEffect(() => {
    setSharedInstance(instanceId);
    return subscribe(() => setCount(getCount()));
  }, []);

  return (
    <view style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
      <text style={{ fontSize: '28px', fontWeight: 'bold' }}>{props.name}</text>

      <text style={{ marginTop: '16px', fontSize: '20px' }}>
        shared count: {count}
      </text>
      <text style={{ marginTop: '4px', fontSize: '12px', color: '#888' }}>
        module instance: {sharedInstance}
      </text>
      <text style={{ marginTop: '4px', fontSize: '12px', color: '#888' }}>
        page lynx: {String(lynx === globalThis.lynx)}
      </text>

      <view
        bindtap={increment}
        style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#2d7ff9',
        }}
      >
        <text style={{ color: '#fff' }}>+1 now</text>
      </view>

      <view
        bindtap={() => {
          setPending(true);
          void incrementLater().then(() =>
            setPending(false)
          );
        }}
        style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#0f9d58',
        }}
      >
        <text style={{ color: '#fff' }}>
          {pending ? '+1 in flight…' : '+1 after 1.5s'}
        </text>
      </view>
    </view>
  );
}

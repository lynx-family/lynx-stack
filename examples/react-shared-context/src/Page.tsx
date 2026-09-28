// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useEffect, useState } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';
import { useLynx } from '@lynx-js/react/internal';

import type { Check } from './store.js';
import {
  getCount,
  getLivePages,
  identityChecks,
  increment,
  incrementLater,
  instanceId,
  registerPage,
  runtimeChecks,
  subscribe,
} from './store.js';

function CheckList(props: { title: string; checks: Check[] }): ReactNode {
  return (
    <view
      style={{ marginTop: '16px', display: 'flex', flexDirection: 'column' }}
    >
      <text style={{ fontSize: '13px', fontWeight: 'bold' }}>
        {props.title}
      </text>
      {props.checks.map((check) => (
        <text
          key={check.label}
          style={{
            marginTop: '2px',
            fontSize: '13px',
            color: check.ok ? '#0f9d58' : '#d93025',
          }}
        >
          {check.ok ? '✓' : '✗'} {check.label}
        </text>
      ))}
    </view>
  );
}

export function Page(props: { name: string }): ReactNode {
  const lynx = useLynx();
  const [count, setCount] = useState(getCount());
  const [pages, setPages] = useState('');
  const [localCount, setLocalCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [sharedInstance, setSharedInstance] = useState('');
  const [lazyInstance, setLazyInstance] = useState('');
  const [identity, setIdentity] = useState<Check[]>([]);
  const [runtime, setRuntime] = useState<Check[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setCount(getCount());
      setPages(getLivePages());
    });
    const unregister = registerPage(props.name);
    setSharedInstance(instanceId);
    void import('./lazy.js').then(({ lazyInstanceId }) =>
      setLazyInstance(lazyInstanceId)
    );
    setIdentity(
      identityChecks({
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        requestAnimationFrame,
        cancelAnimationFrame,
        NativeModules,
      }),
    );
    void runtimeChecks().then(setRuntime);
    return () => {
      unregister();
      unsubscribe();
    };
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
        lazy module instance: {lazyInstance}
      </text>
      <text style={{ marginTop: '4px', fontSize: '12px', color: '#888' }}>
        live pages: {pages}
      </text>
      <text style={{ marginTop: '4px', fontSize: '12px', color: '#888' }}>
        this page only: {localCount}
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
        bindtap={() =>
          setLocalCount((n) => n + 1)}
        style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#8e44ad',
        }}
      >
        <text style={{ color: '#fff' }}>+1 this page only</text>
      </view>

      <view
        bindtap={() => {
          setPending(true);
          void incrementLater().then(() => setPending(false));
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

      <CheckList
        title='this page is isolated'
        checks={[{
          label: 'useLynx() is this page\'s lynx',
          ok: lynx !== globalThis.lynx,
        }]}
      />
      <CheckList
        title='this page holds the captured globals'
        checks={identity}
      />
      {runtime.length > 0
        ? <CheckList title='captured globals still work' checks={runtime} />
        : (
          <text
            style={{ marginTop: '16px', fontSize: '13px', color: '#888' }}
          >
            running captured-globals checks…
          </text>
        )}
    </view>
  );
}

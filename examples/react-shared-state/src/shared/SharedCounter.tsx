import { useLynx, useState } from '@lynx-js/react';

import { bump, bumpAsync, getApp } from './app.js';

export function SharedCounter(props: { page: string }): JSX.Element {
  // Reads through the shared module: reflects what other pages in the same
  // group have already counted.
  const [count, setCount] = useState(() => getApp().globalData.count);
  // Resolves to *this* page's lynx even though the framework chunk is
  // shared — the sanctioned per-page access replacing any direct capture.
  const pageLynx = useLynx() as unknown as {
    getNativeApp(): { id?: string };
  };

  return (
    <view
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#101114',
      }}
    >
      <text
        style={{ fontSize: '13px', color: '#9aa0a6', letterSpacing: '4px' }}
      >
        {props.page}
      </text>
      <text
        style={{
          marginTop: '12px',
          fontSize: '30px',
          color: '#ffffff',
          fontWeight: 'bold',
        }}
      >
        Shared Counter
      </text>
      <text
        style={{
          marginTop: '16px',
          fontSize: '84px',
          color: '#3b82f6',
          fontWeight: 'bold',
        }}
      >
        {count}
      </text>
      <view
        style={{
          marginTop: '24px',
          width: '200px',
          padding: '14px 0',
          borderRadius: '12px',
          backgroundColor: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        bindtap={() => setCount(bump(props.page))}
      >
        <text
          style={{ fontSize: '20px', color: '#ffffff', fontWeight: 'bold' }}
        >
          +1
        </text>
      </view>
      <view
        style={{
          marginTop: '12px',
          width: '200px',
          padding: '14px 0',
          borderRadius: '12px',
          backgroundColor: '#7c3aed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        bindtap={() => {
          void bumpAsync(props.page).then((next) => setCount(next));
        }}
      >
        <text style={{ fontSize: '18px', color: '#ffffff' }}>
          Async +1 (1.5s)
        </text>
      </view>
      <view
        style={{
          marginTop: '12px',
          width: '200px',
          padding: '14px 0',
          borderRadius: '12px',
          border: '1px solid #34373d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        bindtap={() => setCount(getApp().globalData.count)}
      >
        <text style={{ fontSize: '18px', color: '#c8cdd3' }}>Sync</text>
      </view>
      <text style={{ marginTop: '20px', fontSize: '11px', color: '#5f6368' }}>
        useLynx app id:{' '}
        {__BACKGROUND__ ? String(pageLynx.getNativeApp().id ?? 'n/a') : '...'}
      </text>
    </view>
  );
}

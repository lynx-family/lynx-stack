// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, runOnBackground, useState } from '@lynx-js/react';

const initialCounts = {
  btsStart: 0,
  btsMove: 0,
  btsEnd: 0,
  btsCancel: 0,
  mtsStart: 0,
  mtsMove: 0,
  mtsEnd: 0,
  mtsCancel: 0,
  tap: 0,
};

function App() {
  const [counts, setCounts] = useState(initialCounts);
  const record = (name) => {
    setCounts(previous => ({
      ...previous,
      [name]: previous[name] + 1,
    }));
  };
  return (
    <view>
      <view
        id='target'
        style={{
          width: '160px',
          height: '160px',
          backgroundColor: 'pink',
        }}
        bindtouchstart={() => record('btsStart')}
        bindtouchmove={() => record('btsMove')}
        bindtouchend={() => record('btsEnd')}
        bindtouchcancel={() => record('btsCancel')}
        bindtap={() => record('tap')}
        main-thread:bindtouchstart={() => {
          'main thread';
          runOnBackground(record)('mtsStart');
        }}
        main-thread:bindtouchmove={() => {
          'main thread';
          runOnBackground(record)('mtsMove');
        }}
        main-thread:bindtouchend={() => {
          'main thread';
          runOnBackground(record)('mtsEnd');
        }}
        main-thread:bindtouchcancel={() => {
          'main thread';
          runOnBackground(record)('mtsCancel');
        }}
      />
      <text id='bts-start'>{String(counts.btsStart)}</text>
      <text id='bts-move'>{String(counts.btsMove)}</text>
      <text id='bts-end'>{String(counts.btsEnd)}</text>
      <text id='bts-cancel'>{String(counts.btsCancel)}</text>
      <text id='mts-start'>{String(counts.mtsStart)}</text>
      <text id='mts-move'>{String(counts.mtsMove)}</text>
      <text id='mts-end'>{String(counts.mtsEnd)}</text>
      <text id='mts-cancel'>{String(counts.mtsCancel)}</text>
      <text id='tap'>{String(counts.tap)}</text>
    </view>
  );
}

root.render(<App />);

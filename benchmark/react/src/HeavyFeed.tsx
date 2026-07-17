// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const FEED_SIZE = 200;

export function FeedSkeleton() {
  return (
    <view style={{ padding: '8px' }}>
      <text>Loading feed…</text>
    </view>
  );
}

export function HeavyFeed() {
  return (
    <view style={{ flexDirection: 'column' }}>
      {Array.from({ length: FEED_SIZE }).map((_, i) => (
        <view style={{ flexDirection: 'row', padding: '4px' }}>
          <view
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: '#cccccc',
            }}
          />
          <view style={{ flexDirection: 'column', marginLeft: '8px' }}>
            <text>{`Feed item ${i}`}</text>
            <text>{`Description of feed item ${i}`}</text>
          </view>
        </view>
      ))}
    </view>
  );
}

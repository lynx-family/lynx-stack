// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { motion, useMotionValue } from '@lynx-js/motion';

function Item({ index }: { index: number }) {
  const x = useMotionValue(index);
  const increment = () => {
    'main thread';
    x.set(index + 1);
  };

  return (
    <motion.view
      main-thread:bindtap={increment}
      style={{ height: '1px', width: '1px', x }}
    />
  );
}

export function MainThreadObjectWorkload({ count }: { count: number }) {
  return (
    <view>
      {Array.from(
        { length: count },
        (_, index) => <Item index={index} key={index} />,
      )}
    </view>
  );
}

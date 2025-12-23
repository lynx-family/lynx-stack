// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CDPSession } from '@playwright/test';

export const swipe = async (
  cdpSession: CDPSession,
  options: {
    x: number;
    y: number;
    xDistance: number;
    yDistance: number;
    speed?: number;
    steps?: number;
  },
): Promise<void> => {
  const { x, y, yDistance, xDistance, speed = 300, steps = 10 } = options;
  const xStepDistance = xDistance / steps;
  const yStepDistance = yDistance / steps;
  await cdpSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{
      x,
      y,
    }],
  });
  for (let ii = 0; ii < steps + 2; ii++) {
    await cdpSession.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{
        x: x + (ii + 1) * xStepDistance,
        y: y + (ii + 1) * yStepDistance,
      }],
    });
  }
  await cdpSession.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [{
      x: x + xDistance,
      y: y + yDistance,
    }],
  });
};

export const dragAndHold = async (
  cdpSession: CDPSession,
  options: {
    x: number;
    y: number;
    xDistance: number;
    yDistance: number;
  },
): Promise<() => Promise<void>> => {
  const { x, y, xDistance, yDistance } = options;
  await cdpSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        x,
        y,
      },
    ],
  });
  await cdpSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x, y }],
  });
  await cdpSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + xDistance, y: y + yDistance }],
  });
  const touchEnd = async () => {
    await cdpSession.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: x + xDistance, y: y + yDistance }],
    });
  };
  return touchEnd;
};

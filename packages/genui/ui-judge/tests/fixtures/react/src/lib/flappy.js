// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Framework-agnostic flappy-bird physics engine.
 *
 * Manages gravity, jump impulse, and a 60fps game loop.
 * Wire it up to any UI framework by calling `jump()` on tap
 * and reading `getY()` in the loop callback.
 */

export function createFlappy(
  onUpdate,
  options = {},
) {
  const {
    gravity = 0.6,
    jumpForce = -12,
    stackFactor = 0.6,
    frameMs = 16,
  } = options;

  let y = 0;
  let velocity = 0;
  let timer = null;
  let active = true;

  const tick = () => {
    velocity += gravity;
    y += velocity;
    if (y > 0) {
      y = 0;
      velocity = 0;
    }
    onUpdate(y);
  };

  timer = setInterval(tick, frameMs);

  return {
    jump() {
      if (!active) {
        return;
      }
      velocity = velocity < 0
        ? velocity + jumpForce * stackFactor
        : jumpForce;
      tick();
    },
    getY() {
      return y;
    },
    destroy() {
      active = false;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

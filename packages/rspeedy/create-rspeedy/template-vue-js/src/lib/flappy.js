/**
 * Framework-agnostic flappy-bird physics engine.
 *
 * Manages gravity, jump impulse, and a 60fps game loop.
 * Wire it up to any UI framework by calling `jump()` on tap
 * and reading `getY()` in the loop callback.
 *
 * @param {(y: number) => void} onUpdate
 * @param {object} [options]
 * @param {number} [options.gravity=0.6]
 * @param {number} [options.jumpForce=-12]
 * @param {number} [options.stackFactor=0.6]
 * @param {number} [options.frameMs=16]
 * @returns {{ jump: () => void, getY: () => number, destroy: () => void }}
 */
export function createFlappy(onUpdate, options = {}) {
  const {
    gravity = 0.6,
    jumpForce = -12,
    stackFactor = 0.6,
    frameMs = 16,
  } = options

  let y = 0
  let velocity = 0
  let timer = null

  function loop() {
    velocity += gravity
    y += velocity
    if (y >= 0) {
      y = 0
      velocity = 0
      timer = null
      onUpdate(y)
      return
    }
    onUpdate(y)
    timer = setTimeout(loop, frameMs)
  }

  function jump() {
    // Stack impulse on rapid taps, clamped to one full jumpForce
    velocity = Math.min(velocity + jumpForce * stackFactor, jumpForce)
    if (!timer) {
      loop()
    }
  }

  function destroy() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { jump, getY: () => y, destroy }
}

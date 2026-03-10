/**
 * Framework-agnostic flappy-bird physics engine.
 *
 * Manages gravity, jump impulse, and a 60fps game loop.
 * Wire it up to any UI framework by calling `jump()` on tap
 * and reading `getY()` in the loop callback.
 */

export interface FlappyOptions {
  /** Downward acceleration per frame (default 0.6) */
  gravity?: number
  /** Upward impulse per tap — negative value (default -12) */
  jumpForce?: number
  /** Impulse stacking factor for rapid taps (default 0.6) */
  stackFactor?: number
  /** Frame interval in ms (default 16 ≈ 60fps) */
  frameMs?: number
}

export type OnUpdate = (y: number) => void

export interface FlappyEngine {
  /** Call on each tap to apply upward impulse. */
  jump(): void
  /** Current Y offset (0 = ground, negative = airborne). */
  getY(): number
  /** Stop the game loop and clean up. */
  destroy(): void
}

export function createFlappy(
  onUpdate: OnUpdate,
  options: FlappyOptions = {},
): FlappyEngine {
  const {
    gravity = 0.6,
    jumpForce = -12,
    stackFactor = 0.6,
    frameMs = 16,
  } = options

  let y = 0
  let velocity = 0
  let timer: ReturnType<typeof setTimeout> | null = null

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

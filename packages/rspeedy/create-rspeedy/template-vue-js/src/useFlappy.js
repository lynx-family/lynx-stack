import { onUnmounted, ref } from '@lynx-js/vue-runtime'

import { createFlappy } from './lib/flappy.js'

/**
 * Vue composable for flappy-bird physics.
 *
 * Returns a reactive `y` ref and a `jump()` function.
 * The game loop runs automatically; cleanup happens on unmount.
 *
 * @param {object} [options]
 * @returns {{ y: import('vue').Ref<number>, jump: () => void }}
 */
export function useFlappy(options) {
  const y = ref(0)

  const engine = createFlappy((newY) => {
    y.value = newY
  }, options)

  onUnmounted(() => {
    engine.destroy()
  })

  return { y, jump: () => engine.jump() }
}

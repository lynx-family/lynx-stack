import { onUnmounted, ref } from '@lynx-js/vue-runtime';

import { createFlappy } from './lib/flappy.js';
import type { FlappyOptions } from './lib/flappy.js';

/**
 * Vue composable for flappy-bird physics.
 *
 * Returns a reactive `y` ref and a `jump()` function.
 * The game loop runs automatically; cleanup happens on unmount.
 *
 * @example
 * ```vue
 * <script setup>
 * const { y, jump } = useFlappy()
 * </script>
 * <template>
 *   <view @tap="jump" :style="{ transform: `translateY(${y}px)` }">
 *     <text>Tap me!</text>
 *   </view>
 * </template>
 * ```
 */
export function useFlappy(options?: FlappyOptions) {
  const y = ref(0);

  const engine = createFlappy((newY) => {
    y.value = newY;
  }, options);

  onUnmounted(() => {
    engine.destroy();
  });

  return { y, jump: () => engine.jump() };
}

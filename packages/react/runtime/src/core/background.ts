// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactNode } from 'react';

/**
 * Props of the {@link Background} component.
 *
 * @public
 */
export interface BackgroundProps {
  /**
   * The content that opts out of the main-thread first-screen render. It is
   * always rendered by the background thread and shows up once the
   * first-screen hydration completes.
   */
  children?: ReactNode | undefined;

  /**
   * The placeholder rendered during the first screen (e.g. a skeleton). It
   * only ever exists on the main thread: the first-screen hydration replaces
   * it with `children`.
   *
   * Keep the fallback static. Event handlers and refs inside the fallback are
   * never attached, because the fallback is removed when hydration completes.
   *
   * @defaultValue `null` (render nothing during the first screen)
   */
  fallback?: ReactNode | undefined;
}

/**
 * A first-screen boundary that opts its subtree out of the main-thread
 * first-screen render (IFR, Instant First-Frame Rendering).
 *
 * During the main-thread first-screen render, the boundary renders `fallback`
 * (or nothing) instead of `children`. The background thread always renders
 * `children`, and the first-screen hydration replaces the fallback with the
 * real content through the normal update patch.
 *
 * Use it for subtrees that cannot, or should not, participate in the
 * first-screen render, for example when:
 *
 * - the first-screen data of the subtree is only available asynchronously
 *
 * - the subtree relies on capabilities that only exist on the background
 *   thread
 *
 * - the subtree must not run twice (once per thread) during startup
 *
 * `<Background>` is not a performance optimization by itself: the background
 * thread still renders the full tree, and the boundary content is inserted
 * after hydration, which may cause layout shift unless the fallback preserves
 * the layout of `children`.
 *
 * @example
 *
 * ```tsx
 * import { Background } from '@lynx-js/react'
 *
 * function ProfilePage() {
 *   return (
 *     <view>
 *       <Header />
 *       <Background fallback={<FeedSkeleton />}>
 *         <Feed />
 *       </Background>
 *     </view>
 *   )
 * }
 * ```
 *
 * @remarks
 * By default the boundary is a runtime opt-out: the deferred subtree's code is
 * still bundled into the main thread, it just does not run there. To also keep
 * that code out of the main-thread bundle — so no side effect can leak onto the
 * main thread — author the deferred component with the `'background only'`
 * directive. Its render body is then stripped from the main-thread bundle,
 * while its element and main-thread-script (worklet) definitions (which the
 * hydration needs to build the real content) are retained:
 *
 * ```tsx
 * // Feed.tsx
 * export function Feed() {
 *   'background only';
 *   // hooks, effects, event handlers, data formatting — none of this reaches
 *   // the main-thread bundle
 *   return <view>...</view>
 * }
 * ```
 *
 * Use the two together: `<Background>` provides the runtime boundary and the
 * fallback, while the `'background only'` component provides the compile-time
 * separation. The component must be rendered behind a `<Background>` boundary,
 * because its main-thread render is a no-op — rendering it on the first screen
 * without a boundary would produce an empty frame.
 *
 * @public
 */
export function Background(props: BackgroundProps): ReactNode {
  if (__MAIN_THREAD__) {
    return props.fallback ?? null;
  }
  return props.children ?? null;
}

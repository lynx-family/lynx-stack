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

  /**
   * First-screen content that belongs *inside* this boundary: an island the
   * main thread renders on the first frame and the background thread then
   * adopts, in the middle of a region that is otherwise deferred.
   *
   * The boundary renders `island` ahead of the deferred arm on both threads —
   * `[island, fallback]` on the main thread, `[island, children]` on the
   * background — so the island sits at the same position in both trees and
   * the first-screen hydration matches it rather than replacing it. That
   * fixed position is the restriction the prop exists to impose, and the
   * reason the island is named here instead of somewhere inside `children`:
   * the main thread never runs `children`, so a boundary it did not declare
   * is a position the main thread cannot know.
   *
   * Render it here only. An island that also appears inside `children`
   * renders twice on the background thread.
   *
   * @defaultValue `undefined` (the boundary defers its whole subtree)
   */
  island?: ReactNode | undefined;
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
 * At the render root, `<Background>` declares the whole-program endpoint of
 * the same boundary — a 0.0 first screen:
 *
 * ```tsx
 * root.render(
 *   <Background fallback={<view><text>Loading…</text></view>}>
 *     <App />
 *   </Background>,
 * )
 * ```
 *
 * A production build detects the root-level `<Background>` and stops compiling
 * the *deferred* subtree for the main thread (see the `enableMTSRendering`
 * option of `pluginReactLynx`): the boundary is folded to its `fallback` at
 * compile time, so `children` — and the module closure reachable only through
 * it — never enters the main-thread bundle, while the app's element
 * definitions still travel there for hydration to build the real tree from.
 *
 * The `fallback` stays ordinary main-thread code, so it may contain user
 * components, hooks and computed children like any other subtree. What it
 * must not do is reach for the deferred app: whatever the fallback references
 * is compiled for the main thread, and that is the cost it pays for the first
 * frame.
 *
 * To keep a piece of first-screen content *inside* a deferred region, name it
 * with {@link BackgroundProps.island} rather than reaching for
 * {@link MainThread} down in `children` — the main thread never runs
 * `children`, so a boundary declared in there is at a position it cannot
 * know:
 *
 * ```tsx
 * <Background island={<Nav />} fallback={<FeedSkeleton />}>
 *   <Feed />
 * </Background>
 * ```
 *
 * @public
 */
export function Background(props: BackgroundProps): ReactNode {
  const deferred = __MAIN_THREAD__ ? props.fallback : props.children;
  if (props.island === undefined) {
    return deferred ?? null;
  }
  // Both threads render the same two-slot list, so the island keeps its index
  // across the hand-over and the hydration adopts it.
  return [props.island, deferred ?? null];
}

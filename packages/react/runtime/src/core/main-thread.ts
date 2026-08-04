// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactNode } from 'react';

/**
 * Props of the {@link MainThread} component.
 *
 * @public
 */
export interface MainThreadProps {
  /**
   * The island: the subtree that opts *into* the main-thread first-screen
   * render. Both threads render it — the main thread on the first frame, the
   * background when it renders the page — and the first-screen hydration
   * adopts the elements the main thread already created.
   */
  children?: ReactNode | undefined;

  /**
   * The placeholder rendered on the first screen when the island is not
   * available on the main thread — for example when the build could not
   * compile it into the main-thread bundle.
   *
   * Keep the fallback static, for the same reason `<Background fallback>` has
   * to be static: it only ever exists on the main thread, and the first-screen
   * hydration replaces it.
   *
   * @defaultValue `null` (an empty first frame)
   */
  fallback?: ReactNode | undefined;
}

/**
 * A first-screen boundary that opts its subtree *into* the main-thread
 * first-screen render — the mirror of {@link Background}.
 *
 * `<Background>` and `<MainThread>` are the two ends of the same dial.
 * `<Background>` defers a subtree on a build whose default is "everything
 * renders on the main thread's first frame"; `<MainThread>` promotes a
 * subtree on a build whose default is "nothing does".
 *
 * At the render root, `<MainThread>` declares that the wrapped subtree — and
 * only it — is the main thread's first frame:
 *
 * ```tsx
 * import { MainThread, root } from '@lynx-js/react'
 *
 * import { Shell } from './Shell.js'
 *
 * root.render(
 *   <MainThread fallback={<view className='skeleton' />}>
 *     <Shell />
 *   </MainThread>,
 * )
 * ```
 *
 * A production build detects that root-level `<MainThread>` and stops
 * compiling business code for the main thread (the same `enableMTSRendering`
 * switch a root `<Background>` flips), *except* for the island: the module
 * `Shell` comes from is compiled into the main-thread layer, so the main
 * thread renders it — with working main-thread event handlers and worklets —
 * before the background exists.
 *
 * Because both threads render `children`, the first-screen hydration matches
 * the background's render against the island the main thread already built
 * and **adopts** it: the elements, their worklet contexts and their gesture
 * state survive the handover instead of being torn down and re-inserted.
 *
 * The island component itself must be authored with the
 * `'main thread component'` directive, which is what puts its module in the
 * main-thread bundle:
 *
 * ```tsx
 * // Shell.tsx
 * export function Shell() {
 *   'main thread component';
 *   return (
 *     <view className='page'>
 *       <Header />
 *       <Background fallback={<FeedSkeleton />}>
 *         <Feed />
 *       </Background>
 *     </view>
 *   )
 * }
 * ```
 *
 * Everything the island renders is compiled into the main-thread layer with
 * it, so keep the island's imports small and mark the deferred parts with
 * `'background only'`.
 *
 * @remarks
 * On a build that already renders everything on the main thread's first frame
 * (`enableMTSRendering: true`, the classic dual-thread build) the boundary is
 * a pass-through: both threads render `children` and `fallback` is unused.
 *
 * What adoption covers is exactly what IFR's hydration covers, because it is
 * the same hydration — the island is simply the only part of the tree the
 * main thread rendered. Elements keep their identity, their attributes and
 * their event bindings, and a worklet context is hydrated in place rather
 * than re-created. A `main-thread:ref` that no worklet closes over follows
 * the ordinary first-screen ref semantics: its first-screen cell is not
 * carried into the hydrated ref.
 *
 * @public
 */
export function MainThread(props: MainThreadProps): ReactNode {
  // Transparent on both threads, exactly like `<Background>`: the boundary
  // must not add a node of its own, or the main thread's island and the
  // background's render of the same subtree would no longer line up for the
  // first-screen hydration to adopt.
  return props.children ?? null;
}

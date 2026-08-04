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
 *   <MainThread>
 *     <Shell />
 *   </MainThread>,
 * )
 * ```
 *
 * A production build detects that root-level `<MainThread>` and stops
 * compiling business code for the main thread (the same `enableMTSRendering`
 * switch a root `<Background>` flips) — *except* for what the boundary keeps
 * referencing. `Shell`, and everything it renders, is compiled for the main
 * thread and runs there, with working main-thread event handlers and
 * worklets, before the background exists.
 *
 * Use `<Background>` inside the island for the parts that should not come
 * along; the build folds those boundaries down to their `fallback`, so the
 * deferred subtree's code never reaches the main-thread bundle:
 *
 * ```tsx
 * // Shell.tsx
 * export function Shell() {
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
 * Because both threads render `children`, the first-screen hydration matches
 * the background's render against the island the main thread already built
 * and **adopts** it: the elements are taken over rather than torn down and
 * re-inserted.
 *
 * @remarks
 * On a build that already renders everything on the main thread's first frame
 * (`enableMTSRendering: true`, the classic dual-thread build) the boundary is
 * a pass-through and changes nothing.
 *
 * What adoption covers is exactly what IFR's hydration covers, because it is
 * the same hydration — the island is simply the only part of the tree the
 * main thread rendered. Elements keep their identity, their attributes and
 * their event bindings, and a worklet context is hydrated in place rather
 * than re-created. A `main-thread:ref` that no worklet closes over follows
 * the ordinary first-screen ref semantics: its first-screen cell is not
 * carried into the hydrated ref.
 *
 * A component that must be on the main thread even though nothing on the
 * first-frame render path references it — one placed behind a
 * `<Background>`, or resolved indirectly — declares that at its definition
 * with the `'main thread component'` directive, which puts its module in the
 * main-thread bundle regardless of who references it.
 *
 * That directive settles *compilation*, not *position*, and the two are
 * separate problems. A `<MainThread>` only renders on the first frame if the
 * whole spine down to it is main-thread code; inside a `<Background>`'s
 * `children` — which the main thread never runs — there is no position for it
 * to render at, and the island appears only once the background has
 * hydrated. To keep something on the first frame inside a deferred region,
 * name it on the boundary with `<Background island={…}>`, which puts it at a
 * position both threads agree on.
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

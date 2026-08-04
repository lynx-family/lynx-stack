// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The runtime half of a main-thread island: the first frame of a build that
 * compiles no business code for the main thread *except* the island.
 *
 * This module is deliberately reachable only from
 * `runtime/mts-rendering-disabled/islands.js`, the main-thread entry the build
 * picks when an entry declares a root-level `<MainThread>`. It pulls the
 * main-thread renderer back into the bundle, which is the whole cost of the
 * feature — a build without islands must not pay it.
 */

import { createElement } from 'preact';
import type { ComponentType } from 'preact';

import { __root } from './root.js';
import { profileEnd, profileStart } from './shared/profile.js';
import { setMainThreadFirstFrame } from './snapshot/lifecycle/render.js';
import { render as renderToString } from './snapshot/renderToOpcodes/index.js';
import type { SnapshotInstance } from './snapshot/snapshot/snapshot.js';

/**
 * Where the build hands the island component over.
 *
 * The island's module is a *separate* entry module of the main-thread chunk,
 * added after the framework entry, so the framework entry cannot import it —
 * it would not exist yet at that point. The island entry writes the component
 * here on its way through the chunk's bootstrap instead, and the first frame
 * reads it back inside `renderPage`, by which time every entry module has run.
 *
 * @internal
 */
export const MAIN_THREAD_ROOT_ISLAND: symbol = Symbol.for(
  '__REACT_LYNX_MTS_ROOT_ISLAND__',
);

/**
 * The island component the build registered, if any.
 *
 * @internal
 */
export function getRootMainThreadIsland(): ComponentType | undefined {
  return (globalThis as unknown as Record<symbol, ComponentType | undefined>)[MAIN_THREAD_ROOT_ISLAND];
}

/**
 * Render the island as the main thread's first frame.
 *
 * This is the ordinary main-thread render — the same one IFR runs for the
 * whole tree — scoped to the island's subtree. That is exactly what makes the
 * handover an *adoption*: the island's snapshot ids are the ones the
 * background compilation produced for the very same source, so the
 * first-screen hydrate matches the background's render of `<MainThread>`
 * against the instances built here and takes ownership of their elements,
 * instead of removing them and creating new ones.
 *
 * @internal
 */
export function renderRootMainThreadIsland(Island: ComponentType): void {
  if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
    profileStart('ReactLynx::renderMainThreadIsland');
  }
  try {
    const jsx = createElement(Island, null);
    // `updatePage` before the first screen is synced re-renders from
    // `__root.__jsx` into a fresh root, so the island has to be reachable
    // from there too, not only from this call.
    __root.__jsx = jsx as unknown as typeof __root.__jsx;
    renderToString(jsx, undefined, __root as SnapshotInstance);
  } finally {
    if (typeof __PROFILE__ !== 'undefined' && __PROFILE__) {
      profileEnd();
    }
  }
}

/**
 * Install the island first frame on the assembled main-thread bundle.
 *
 * `renderStaticFallback` is the M1 path — the static `fallback` snapshot the
 * root boundary declared. It is what paints when no island was registered,
 * which is how a build that could not compile the island degrades: an empty
 * or skeleton first frame, then the ordinary full-insert hydration.
 *
 * @internal
 */
export function installMainThreadIslandFirstFrame(
  renderStaticFallback: () => void,
): void {
  setMainThreadFirstFrame(() => {
    const Island = getRootMainThreadIsland();
    if (Island) {
      renderRootMainThreadIsland(Island);
    } else {
      renderStaticFallback();
    }
  });
}

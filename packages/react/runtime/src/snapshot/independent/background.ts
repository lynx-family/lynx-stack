// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options, render } from 'preact';
import type { ContainerNode, VNode } from 'preact';

import { installIndependentCommitHook } from './commit.js';
import { installIndependentEventHandlers } from './events.js';
import { CHILDREN, PARENT, RENDER } from '../../shared/render-constants.js';
import { genCommitTaskId } from '../lifecycle/patch/commit.js';
import type { PatchList, PatchOptions } from '../lifecycle/patch/commit.js';
import { takeGlobalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import { BackgroundSnapshotInstance, hydrate } from '../snapshot/backgroundSnapshot.js';
import type { SerializedSnapshotInstance } from '../snapshot/types.js';

interface BackgroundRoot {
  render(vnode: VNode | null): void;
  hydrate(snapshot: string): PatchList;
  destroy(): void;
}

type Submit = (patches: PatchList, options: PatchOptions, finish: () => void) => void;
interface RootState {
  root: BackgroundRoot;
  submit: Submit;
}

/** Creates the background renderer for a dedicated page of independent roots. */
export function createBackgroundRenderer() {
  const events = installIndependentEventHandlers();
  const owners = new WeakMap<object, RootState>();
  let active: RootState | undefined;
  let rendering: VNode | undefined;

  function withRoot<T>(state: RootState, fn: () => T): T {
    const previous = active;
    active = state;
    try {
      return fn();
    } finally {
      active = previous;
    }
  }
  function findOwner(vnode: VNode | undefined): RootState | undefined {
    if (active) return active;
    let node = vnode;
    while (node) {
      const found = owners.get(node);
      if (found) return found;
      node = (node as unknown as Record<string, VNode>)[PARENT];
    }
    return undefined;
  }

  // Scheduled state updates render outside the explicit root.render call.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const previousRender = options[RENDER];
  const trackRender: NonNullable<typeof previousRender> = vnode => {
    rendering = vnode;
    previousRender?.(vnode);
  };
  options[RENDER] = trackRender;
  const removeCommitHook = installIndependentCommitHook((vnode, patches, patchOptions, finish) => {
    const owner = findOwner(vnode);
    if (!owner) {
      finish();
      throw new Error('Commit rendered outside an independent root');
    }
    owner.submit(patches, patchOptions, finish);
  });

  return {
    /** Creates a root whose commits are delivered to the caller for transport. */
    createRoot(submit: Submit): BackgroundRoot {
      const snapshot = new BackgroundSnapshotInstance('root');
      const root: BackgroundRoot = {
        render(vnode) {
          withRoot(state, () => render(vnode, snapshot as unknown as ContainerNode));
          const vnodeRoot = (snapshot as unknown as Record<string, object>)[CHILDREN];
          if (vnodeRoot) owners.set(vnodeRoot, state);
        },
        hydrate(serialized) {
          const patch = withRoot(state, () => hydrate(JSON.parse(serialized) as SerializedSnapshotInstance, snapshot));
          takeGlobalSnapshotPatch();
          return { patchList: [{ id: genCommitTaskId(), snapshotPatch: patch }] };
        },
        destroy() {
          root.render(null);
          snapshot.tearDown();
        },
      };
      const state: RootState = { root, submit };
      return root;
    },
    /** Returns the root executing the current component, for optional instrumentation. */
    getCurrentRoot(): BackgroundRoot | undefined {
      return findOwner(rendering)?.root;
    },
    /** Replays native events after a root's hydration commit is acknowledged. */
    flushEvents(): void {
      events.flush();
    },
    /** Restores page-level event handlers and Preact hooks after all roots are destroyed. */
    dispose(): void {
      removeCommitHook();
      if (options[RENDER] === trackRender) {
        if (previousRender) options[RENDER] = previousRender;
        else delete options[RENDER];
      }
      events.dispose();
    },
  };
}

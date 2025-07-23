// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, options } from 'preact';
import type { ComponentClass, VNode } from 'preact';

import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import { COMPONENT, DIFF, DIFFED, DIRTY, NEXT_STATE, RENDER } from '../renderToOpcodes/constants.js';
import { getDisplayName, hook, mapGetAndDelete, nullishCoalescingMapSet } from '../utils.js';

export function initProfileHook(): void {
  // early-exit if required profiling APIs are unavailable
  if (
    !lynx.performance
    || typeof lynx.performance.profileStart !== 'function'
    || typeof lynx.performance.profileEnd !== 'function'
    || typeof lynx.performance.profileMark !== 'function'
    || typeof lynx.performance.profileFlowId !== 'function'
  ) {
    return;
  }

  const flowIdMap = new WeakMap<Component, number>();
  const globalSnapshotPatchLengthMap = new WeakMap<VNode, number>();

  const profileStart = lynx.performance.profileStart.bind(lynx.performance);
  const profileEnd = lynx.performance.profileEnd.bind(lynx.performance);

  hook(options, DIFF, (old, vnode) => {
    if (typeof vnode.type === 'function') {
      // We only add profiling trace for Component

      const flowId = mapGetAndDelete(flowIdMap, vnode[COMPONENT]!);
      profileStart(
        `diff::${getDisplayName(vnode.type as ComponentClass)}`,
        flowId ? { flowId } : {},
      );

      if (__BACKGROUND__ && __globalSnapshotPatch) {
        nullishCoalescingMapSet(
          globalSnapshotPatchLengthMap,
          vnode,
          () => __globalSnapshotPatch?.length,
        );
      }
    }
    old?.(vnode);
  });

  hook(options, DIFFED, (old, vnode) => {
    if (typeof vnode.type === 'function') {
      if (
        __BACKGROUND__ && __globalSnapshotPatch
        && __globalSnapshotPatch.length === mapGetAndDelete(globalSnapshotPatchLengthMap, vnode)
      ) {
        lynx.performance.profileMark('no-op after diff', {
          args: {
            componentName: getDisplayName(vnode.type as ComponentClass),
          },
        });
      }

      profileEnd(); // for options[DIFF]
    }
    old?.(vnode);
  });

  hook(
    Component.prototype,
    'setState',
    function(this: Component & { [NEXT_STATE]: unknown }, old, state, callback) {
      old?.call(this, state, callback);

      if (this[DIRTY]) {
        lynx.performance.profileMark('setState', {
          flowId: nullishCoalescingMapSet(flowIdMap, this, () => lynx.performance.profileFlowId()),
          args: buildSetStateProfileMarkArgs(
            this.state as Record<string, unknown>,
            this[NEXT_STATE] as Record<string, unknown>,
          ),
        });
      }
    },
  );

  // Profile the user-provided `render`.
  hook(options, RENDER, (old, vnode: VNode) => {
    const displayName = getDisplayName(vnode.type as ComponentClass);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalRender = vnode[COMPONENT]!.render;
    vnode[COMPONENT]!.render = function render(this, props, state, context) {
      profileStart(`render::${displayName}`);
      try {
        return originalRender.call(this, props, state, context);
      } finally {
        profileEnd();
        vnode[COMPONENT]!.render = originalRender;
      }
    };
    old?.(vnode);
  });
}

function buildSetStateProfileMarkArgs(
  currentState: Record<string, unknown>,
  nextState: Record<string, unknown>,
): Record<string, string> {
  const EMPYT_OBJ = {};

  currentState ??= EMPYT_OBJ;
  nextState ??= EMPYT_OBJ;

  return {
    'current state keys': JSON.stringify(Object.keys(currentState)),
    'next state keys': JSON.stringify(Object.keys(nextState)),
    'changed (shallow diff) state keys': JSON.stringify(
      // the setState is in assign manner, we assume nextState is a superset of currentState
      Object.keys(nextState).filter(
        key => currentState[key] !== nextState[key],
      ),
    ),
  };
}

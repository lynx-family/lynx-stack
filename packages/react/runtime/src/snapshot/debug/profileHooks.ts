// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, options } from 'preact';
import type { ComponentClass, VNode } from 'preact';

import type { TraceOption } from '@lynx-js/types';

import {
  BITS,
  COMMIT,
  COMPONENT,
  COMPONENT_DIRTY,
  DIFF,
  DIFF2,
  DIFFED,
  HOOKS,
  LIST,
  NEXT_VALUE,
  RENDER,
  VNODE,
} from '../../shared/render-constants.js';
import { getDisplayName } from '../../utils.js';
import { globalPatchOptions } from '../lifecycle/patch/commit.js';
import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

export function initProfileHook(): void {
  // early-exit if required profiling APIs are unavailable
  let p;
  /* v8 ignore start */
  if (
    !(p = lynx.performance)
    || typeof p.profileStart !== 'function'
    || typeof p.profileEnd !== 'function'
    || typeof p.profileMark !== 'function'
    || typeof p.profileFlowId !== 'function'
  ) {
    return;
  }
  /* v8 ignore stop */

  const profileStart = p.profileStart.bind(p);
  const profileEnd = p.profileEnd.bind(p);
  const profileMark = p.profileMark.bind(p);
  const profileFlowId = p.profileFlowId.bind(p);

  // for each setState call, we will add a profiling trace and
  // attach a flowId to the component instance.
  // This allows us to trace the flow of its diffing, committing and patching.
  {
    const sFlowID = Symbol('FLOW_ID');
    type PatchedComponent = Component & { [sFlowID]?: number };

    function markSetState(component: PatchedComponent, hookIdx?: number): void {
      try {
        const type = component[VNODE]!.type;
        if (
          hookIdx === undefined
          && !(typeof type === 'function' && ('prototype' in type) && ('render' in type.prototype))
        ) {
          return;
        }
        // Update traces describe the framework's work without inspecting application state.
        const args: Record<string, string> = {
          componentName: typeof type === 'function' ? getDisplayName(type as ComponentClass) : 'Unknown',
        };
        if (hookIdx !== undefined) {
          args['hookIdx'] = String(hookIdx);
        }
        const flowId = component[sFlowID] ?? profileFlowId();
        profileMark(hookIdx === undefined ? 'ReactLynx::setState' : 'ReactLynx::hooks::setState', { flowId, args });
        component[sFlowID] = flowId;
      } catch {
        // A profiling failure must not interrupt Preact's update or scheduling.
      }
    }

    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const oldSetState = Component.prototype.setState;
      Component.prototype.setState = function(this: PatchedComponent, state, callback) {
        oldSetState?.call(this, state, callback);

        if (this[BITS] & COMPONENT_DIRTY) {
          markSetState(this);
        }
      };
    }

    // These hot callbacks have fixed signatures; avoid collecting and spreading
    // an argument array for every host and component visited.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldDiff2 = options[DIFF2];
    options[DIFF2] = (vnode, oldVNode) => {
      // We only add profiling trace for Component
      if (typeof vnode.type === 'function') {
        const profileOptions: TraceOption = {};

        if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
          const c: PatchedComponent = oldVNode[COMPONENT]!;
          if (c) {
            const flowId = c[sFlowID];
            delete c[sFlowID];
            if (flowId) {
              globalPatchOptions.flowIds ??= [];
              globalPatchOptions.flowIds.push(flowId);
              profileOptions.flowId = flowId;
            }
          }
        }

        profileStart(
          `ReactLynx::diff::${/* #__INLINE__ */ getDisplayName(vnode.type as ComponentClass)}`,
          profileOptions,
        );
      }
      oldDiff2?.(vnode, oldVNode);
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldDiffed = options[DIFFED];
    options[DIFFED] = vnode => {
      if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
        const hooks = vnode[COMPONENT]?.[HOOKS];
        const hookList = hooks?.[LIST];

        if (Array.isArray(hookList)) {
          hookList.forEach((hookState, hookIdx: number) => {
            hookState['internalNextValue'] = hookState[NEXT_VALUE];
            // define a setter for __N to track the next value of the hook
            Object.defineProperty(hookState, NEXT_VALUE, {
              get: () => hookState['internalNextValue'],
              set: (value) => {
                hookState['internalNextValue'] = value;
                if (Array.isArray(value)) {
                  const component = hookState[COMPONENT] as PatchedComponent | undefined;
                  if (component) {
                    markSetState(component, hookIdx);
                  }
                }
              },
              configurable: true,
            });
          });
        }
      }

      if (typeof vnode.type === 'function') {
        profileEnd(); // for options[DIFF2]
      }
      oldDiffed?.(vnode);
    };

    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const oldCommit = options[COMMIT];
      options[COMMIT] = (vnode, commitQueue) => {
        profileStart('ReactLynx::commit', {
          ...globalPatchOptions.flowIds
            ? {
              flowId: globalPatchOptions.flowIds[0],
              flowIds: globalPatchOptions.flowIds,
            }
            : {},
        });
        oldCommit?.(vnode, commitQueue);
        profileEnd();
      };
    }
  }

  // Profile the user-provided `render`.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const oldRender = options[RENDER];
  options[RENDER] = (vnode: VNode) => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalRender = vnode[COMPONENT]!.render;
    vnode[COMPONENT]!.render = function render(this, props, state, context) {
      profileStart(`ReactLynx::render::${/* #__INLINE__ */ getDisplayName(vnode.type as ComponentClass)}`);
      try {
        return originalRender.call(this, props, state, context);
      } finally {
        profileEnd();
        vnode[COMPONENT]!.render = originalRender;
      }
    };
    oldRender?.(vnode);
  };

  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    const sPatchLength = Symbol('PATCH_LENGTH');

    type PatchedVNode = VNode & { [sPatchLength]?: number };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldDiff = options[DIFF];
    options[DIFF] = (vnode: PatchedVNode) => {
      if (typeof vnode.type === 'function' && __globalSnapshotPatch) {
        vnode[sPatchLength] = __globalSnapshotPatch.length;
      }
      oldDiff?.(vnode);
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldPatchDiffed = options[DIFFED];
    options[DIFFED] = (vnode: PatchedVNode) => {
      if (typeof vnode.type === 'function') {
        const patchLength = vnode[sPatchLength];
        delete vnode[sPatchLength];
        if (__globalSnapshotPatch && patchLength === __globalSnapshotPatch.length) {
          // "NoPatch" is a conventional name in Lynx
          profileMark('ReactLynx::diffFinishNoPatch', {
            args: {
              componentName: /* #__INLINE__ */ getDisplayName(vnode.type as ComponentClass),
            },
          });
        }
      }
      oldPatchDiffed?.(vnode);
    };
  }
}

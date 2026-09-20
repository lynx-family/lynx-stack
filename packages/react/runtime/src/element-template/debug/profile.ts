// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, options } from 'preact';
import type { ComponentClass, VNode } from 'preact';

import type { TraceOption } from '@lynx-js/types';

import { profileEnd, profileStart } from '../../shared/profile.js';
import {
  BITS,
  COMMIT,
  COMPONENT,
  COMPONENT_DIRTY,
  DIFF,
  DIFF2,
  DIFFED,
  NEXT_STATE,
  RENDER,
} from '../../shared/render-constants.js';
import { getDisplayName } from '../../utils.js';
import { globalCommitContext } from '../background/commit-context.js';

let installed = false;

export { profileEnd, profileStart };

export function initProfileHook(): void {
  if (installed) {
    return;
  }
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
  installed = true;

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

    if (__BACKGROUND__) {
      function buildSetStateProfileMarkArgs(
        currentState: Record<string, unknown>,
        nextState: Record<string, unknown>,
      ): Record<string, string> {
        const EMPTY_OBJ = {};

        currentState ??= EMPTY_OBJ;
        nextState ??= EMPTY_OBJ;

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

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const oldSetState = Component.prototype.setState;
      Component.prototype.setState = function(this: PatchedComponent & { [NEXT_STATE]: unknown }, state, callback) {
        oldSetState?.call(this, state, callback);

        if (this[BITS] & COMPONENT_DIRTY) {
          profileMark('ReactLynx::setState', {
            flowId: this[sFlowID] ??= profileFlowId(),
            args: buildSetStateProfileMarkArgs(
              this.state as Record<string, unknown>,
              this[NEXT_STATE] as Record<string, unknown>,
            ),
          });
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

        if (__BACKGROUND__) {
          const c = oldVNode?.[COMPONENT] as PatchedComponent | undefined;
          if (c) {
            const flowId = c[sFlowID];
            delete c[sFlowID];
            if (flowId) {
              const flowIds = globalCommitContext.flowIds
                ?? (globalCommitContext.flowIds = []);
              flowIds.push(flowId);
              profileOptions.flowId = flowId;
            }
          }
        }

        profileStart(
          `ReactLynx::diff::${/* #__INLINE__ */ getDisplayName(vnode.type as ComponentClass)}`,
          profileOptions,
        );
      }
      /* v8 ignore next */
      oldDiff2?.(vnode, oldVNode);
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldDiffed = options[DIFFED];
    options[DIFFED] = vnode => {
      if (typeof vnode.type === 'function') {
        profileEnd(); // for options[DIFF]
      }
      oldDiffed?.(vnode);
    };

    if (__BACKGROUND__) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const oldCommit = options[COMMIT];
      options[COMMIT] = (vnode, commitQueue) => {
        const globalFlowIds = globalCommitContext.flowIds;
        const commitProfileOptions = globalFlowIds && globalFlowIds.length > 0
          ? { flowId: globalFlowIds[0], flowIds: [...globalFlowIds] }
          : {};

        profileStart('ReactLynx::commit', commitProfileOptions);
        /* v8 ignore next */
        oldCommit?.(vnode, commitQueue);
        profileEnd();
        delete globalCommitContext.flowIds;
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

  if (__BACKGROUND__) {
    const sPatchLength = Symbol('PATCH_LENGTH');

    type PatchedVNode = VNode & { [sPatchLength]?: number };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldDiff = options[DIFF];
    options[DIFF] = (vnode: PatchedVNode) => {
      if (typeof vnode.type === 'function') {
        vnode[sPatchLength] = globalCommitContext.ops.length;
      }
      oldDiff?.(vnode);
    };

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const oldPatchDiffed = options[DIFFED];
    options[DIFFED] = (vnode: PatchedVNode) => {
      if (typeof vnode.type === 'function') {
        if (vnode[sPatchLength] === globalCommitContext.ops.length) {
          // "NoPatch" is a conventional name in Lynx
          profileMark('ReactLynx::diffFinishNoPatch', {
            args: {
              componentName: /* #__INLINE__ */ getDisplayName(vnode.type as ComponentClass),
            },
          });
        }
        delete vnode[sPatchLength];
      }
      oldPatchDiffed?.(vnode);
    };
  }
}

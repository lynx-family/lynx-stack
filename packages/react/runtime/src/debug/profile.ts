// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Component, options } from 'preact';
import type { ComponentClass, ComponentType, VNode } from 'preact';

import type { TraceOption } from '@lynx-js/types';

import { globalPatchOptions } from '../lifecycle/patch/commit.js';
import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';
import {
  COMMIT,
  COMPONENT,
  DIFF,
  DIFF2,
  DIFFED,
  DIRTY,
  HOOKS,
  LIST,
  NEXT_STATE,
  NEXT_VALUE,
  RENDER,
  VALUE,
  VNODE,
} from '../renderToOpcodes/constants.js';
import { getDisplayName, hook } from '../utils.js';

const format = (val: unknown) => {
  if (typeof val === 'function') {
    return val.toString();
  }
  return val;
};

function safeJsonStringify(val: unknown) {
  const seen = new WeakSet<object>();

  return JSON.stringify(val, function(_key, value: unknown) {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Unserializable: Circular]';
      }
      seen.add(value);
    }

    return value;
  });
}

function buildSetStateProfileMarkArgs(
  type: string | ComponentType | undefined,
  currentState: unknown,
  nextState: unknown,
): Record<string, string> {
  const EMPTY_OBJ = {};

  const currentStateObj = (currentState ?? EMPTY_OBJ) as Record<string, unknown>;
  const nextStateObj = (nextState ?? EMPTY_OBJ) as Record<string, unknown>;

  return {
    componentName: (type && typeof type === 'function')
      ? getDisplayName(type as ComponentClass)
      : 'Unknown',
    'current state keys': JSON.stringify(Object.keys(currentStateObj)),
    'next state keys': JSON.stringify(Object.keys(nextStateObj)),
    'changed (shallow diff) state keys': JSON.stringify(
      // the setState is in assign manner, we assume nextState is a superset of currentState
      Object.keys(nextStateObj).filter(
        key => currentStateObj[key] !== nextStateObj[key],
      ),
    ),
    currentValue: safeJsonStringify(format(currentState)),
    nextValue: safeJsonStringify(format(nextState)),
  };
}

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

    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      hook(
        Component.prototype,
        'setState',
        function(this: PatchedComponent & { [NEXT_STATE]: unknown }, old, state, callback) {
          old?.call(this, state, callback);

          if (this[DIRTY]) {
            const type = this[VNODE]!.type;
            const isClassComponent = typeof type === 'function' && ('prototype' in type)
              && ('render' in type.prototype);

            if (isClassComponent) {
              profileMark('ReactLynx::setState', {
                flowId: this[sFlowID] ??= profileFlowId(),
                args: buildSetStateProfileMarkArgs(
                  type,
                  this.state,
                  this[NEXT_STATE],
                ),
              });
            }
          }
        },
      );
    }

    hook(options, DIFF2, (old, vnode, oldVNode) => {
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
      old?.(vnode, oldVNode);
    });

    hook(options, DIFFED, (old, vnode) => {
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
                if (Array.isArray(value)) {
                  // hookState[VALUE] is [state, dispatch]
                  const currentValueTuple = hookState[VALUE] as unknown[];
                  const currentValue = currentValueTuple[0];
                  const [nextValue] = value as unknown[];

                  const component = hookState[COMPONENT] as PatchedComponent | undefined;
                  if (!component) {
                    hookState['internalNextValue'] = value;
                    return;
                  }

                  const type = component[VNODE]!.type;
                  const flowId = component[sFlowID] ??= profileFlowId();

                  profileMark('ReactLynx::hooks::setState', {
                    flowId,
                    args: {
                      hookIdx: String(hookIdx),
                      ...buildSetStateProfileMarkArgs(
                        type,
                        currentValue,
                        nextValue,
                      ),
                    },
                  });
                }
                hookState['internalNextValue'] = value;
              },
              configurable: true,
            });
          });
        }
      }

      if (typeof vnode.type === 'function') {
        profileEnd(); // for options[DIFF]
      }
      old?.(vnode);
    });

    if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
      hook(options, COMMIT, (old, vnode, commitQueue) => {
        profileStart('ReactLynx::commit', {
          ...globalPatchOptions.flowIds
            ? {
              flowId: globalPatchOptions.flowIds[0],
              flowIds: globalPatchOptions.flowIds,
            }
            : {},
        });
        old?.(vnode, commitQueue);
        profileEnd();
      });
    }
  }

  // Profile the user-provided `render`.
  hook(options, RENDER, (old, vnode: VNode) => {
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
    old?.(vnode);
  });

  if (typeof __BACKGROUND__ !== 'undefined' && __BACKGROUND__) {
    const sPatchLength = Symbol('PATCH_LENGTH');

    type PatchedVNode = VNode & { [sPatchLength]?: number };

    hook(options, DIFF, (old, vnode: PatchedVNode) => {
      if (typeof vnode.type === 'function' && __globalSnapshotPatch) {
        vnode[sPatchLength] = __globalSnapshotPatch.length;
      }
      old?.(vnode);
    });

    hook(options, DIFFED, (old, vnode: PatchedVNode) => {
      if (typeof vnode.type === 'function' && __globalSnapshotPatch) {
        if (vnode[sPatchLength] === __globalSnapshotPatch.length) {
          // "NoPatch" is a conventional name in Lynx
          profileMark('ReactLynx::diffFinishNoPatch', {
            args: {
              componentName: /* #__INLINE__ */ getDisplayName(vnode.type as ComponentClass),
            },
          });
        }
        delete vnode[sPatchLength];
      }
      old?.(vnode);
    });
  }
}

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
  NEXT_STATE,
  NEXT_VALUE,
  RENDER,
  VALUE,
  VNODE,
} from '../../shared/render-constants.js';
import { getDisplayName } from '../../utils.js';
import { globalPatchOptions } from '../lifecycle/patch/commit.js';
import { __globalSnapshotPatch } from '../lifecycle/patch/snapshotPatch.js';

const maxStateKeys = 16;
const maxStateStringLength = 80;

function truncateStateString(value: string): string {
  return value.length > maxStateStringLength ? value.slice(0, maxStateStringLength) + '…' : value;
}

function describeStateValue(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return { type: 'string', length: value.length, preview: truncateStateString(value) };
  }
  if (Array.isArray(value)) {
    const length: unknown = Object.getOwnPropertyDescriptor(value, 'length')?.value;
    return typeof length === 'number' ? { type: 'array', length } : { type: 'array' };
  }
  return { type: typeof value };
}

function getStateProperty(state: object | undefined, key: string): PropertyDescriptor | undefined {
  const descriptor = state && Object.getOwnPropertyDescriptor(state, key);
  return descriptor?.enumerable ? descriptor : undefined;
}

function sampleState(state: unknown) {
  const record = state !== null && typeof state === 'object' && !Array.isArray(state) ? state : undefined;
  const properties = new Map<string, PropertyDescriptor>();
  let scanned = 0;
  let truncated = false;
  for (const key in record) {
    if (scanned === maxStateKeys) {
      truncated = true;
      break;
    }
    scanned++;
    const property = getStateProperty(record, key);
    if (property) {
      properties.set(key, property);
    }
  }
  const preview = record
    ? {
      type: 'object',
      entries: Array.from(properties, ([key, property]) => [
        truncateStateString(key),
        'value' in property ? describeStateValue(property.value) : { type: 'accessor' },
      ]),
    }
    : describeStateValue(state);
  return { record, properties, preview, truncated };
}

function buildSetStateProfileMarkArgs(
  type: VNode['type'],
  currentState: unknown,
  nextState: unknown,
): Record<string, string> {
  const current = sampleState(currentState);
  const next = sampleState(nextState);
  const keys = new Set([...current.properties.keys(), ...next.properties.keys()]);
  const changed = [...keys].filter(key => {
    // A key outside the sample can still exist on the other side.
    const before = current.properties.get(key) ?? getStateProperty(current.record, key);
    const after = next.properties.get(key) ?? getStateProperty(next.record, key);
    if (!before || !after) {
      return before !== after;
    }
    if ('value' in before && 'value' in after) {
      return !Object.is(before.value, after.value);
    }
    return ('value' in before) !== ('value' in after) || before.get !== after.get || before.set !== after.set;
  });

  const name = typeof type === 'function' ? getDisplayName(type as ComponentClass) : undefined;
  return {
    componentName: typeof name === 'string' ? truncateStateString(name) : 'Unknown',
    'current state keys': JSON.stringify(Array.from(current.properties.keys(), truncateStateString)),
    'next state keys': JSON.stringify(Array.from(next.properties.keys(), truncateStateString)),
    'changed (shallow diff) state keys': JSON.stringify(
      changed.slice(0, maxStateKeys).map(key => truncateStateString(key)),
    ),
    ...(current.truncated || next.truncated || changed.length > maxStateKeys ? { 'state keys truncated': 'true' } : {}),
    currentValue: JSON.stringify(current.preview),
    nextValue: JSON.stringify(next.preview),
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

    function markSetState(component: PatchedComponent, current: unknown, next: unknown, hookIdx?: number): void {
      try {
        const type = component[VNODE]!.type;
        if (
          hookIdx === undefined
          && !(typeof type === 'function' && ('prototype' in type) && ('render' in type.prototype))
        ) {
          return;
        }
        const args = buildSetStateProfileMarkArgs(type, current, next);
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
      Component.prototype.setState = function(this: PatchedComponent & { [NEXT_STATE]: unknown }, state, callback) {
        oldSetState?.call(this, state, callback);

        if (this[BITS] & COMPONENT_DIRTY) {
          markSetState(this, this.state, this[NEXT_STATE]);
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
                const pending = hookState['internalNextValue'] as unknown[] | undefined;
                hookState['internalNextValue'] = value;
                if (Array.isArray(value)) {
                  const component = hookState[COMPONENT] as PatchedComponent | undefined;
                  if (component) {
                    // The reducer uses the pending tuple as its baseline for batched dispatches.
                    const previous = pending ?? hookState[VALUE] as unknown[];
                    markSetState(component, previous[0], value[0], hookIdx);
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

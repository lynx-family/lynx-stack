// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FunctionComponent, VNode } from 'preact';
import { Suspense as PreactSuspense, createElement as createElementBackground } from 'preact/compat';
import { useRef } from 'preact/hooks';

import { createElement as createElementMainThread } from '@lynx-js/react/lepus';

import type { BackgroundSnapshotInstance } from '../backgroundSnapshot.js';
import { globalBackgroundSnapshotInstancesToRemove } from '../lifecycle/patch/commit.js';

export const Suspense: FunctionComponent<{ children: VNode | VNode[]; fallback: VNode }> = (
  { children, fallback },
) => {
  const __createElement =
    (__MAIN_THREAD__ ? createElementMainThread : createElementBackground) as typeof createElementBackground;
  const childrenRef = useRef<BackgroundSnapshotInstance>();

  // @ts-expect-error wrapper is a valid element type
  const newChildren = __createElement('wrapper', {
    ref: (bsi: BackgroundSnapshotInstance) => {
      if (bsi) {
        childrenRef.current = bsi;
      }
    },
  }, children);

  // @ts-expect-error wrapper is a valid element type
  const newFallback = __createElement('wrapper', {
    ref: (bsi: BackgroundSnapshotInstance) => {
      if (bsi && childrenRef.current) {
        const i = globalBackgroundSnapshotInstancesToRemove.indexOf(childrenRef.current.__id);
        if (i !== -1) {
          globalBackgroundSnapshotInstancesToRemove.splice(i, 1);
        }
        childrenRef.current = undefined;
      }
    },
  }, fallback);

  return __createElement(PreactSuspense, { fallback: newFallback }, newChildren);
};

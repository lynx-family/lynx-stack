// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import type { Component, ComponentClass, VNode } from 'preact';

import { COMPONENT, DIFF, DIFFED, RENDER } from '../renderToOpcodes/constants.js';
import { getDisplayName } from '../utils.js';

export function initProfileHook(): void {
  const oldDiff = options[DIFF];
  options[DIFF] = function(vnode: VNode) {
    // This __PROFILE__ is used for DCE testing
    if (__PROFILE__ && typeof vnode.type === 'function') {
      // We only add profiling trace for Component
      console.profile(`diff::${getDisplayName(vnode.type as ComponentClass)}`);
    }
    oldDiff?.(vnode);
  };
  const oldDiffed = options[DIFFED];
  options[DIFFED] = function(vnode) {
    // This __PROFILE__ is used for DCE testing
    if (__PROFILE__ && typeof vnode.type === 'function') {
      console.profileEnd(); // for options[DIFF]
    }
    oldDiffed?.(vnode);
  };

  // Profile the user-provided `render`.
  const oldRender = options[RENDER];
  options[RENDER] = function(vnode: VNode & { [COMPONENT]: Component }) {
    const displayName = getDisplayName(vnode.type as ComponentClass);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalRender = vnode[COMPONENT].render;
    vnode[COMPONENT].render = function render(this, props, state, context) {
      // This __PROFILE__ is used for DCE testing
      if (__PROFILE__) {
        console.profile(`render::${displayName}`);
      }
      try {
        return originalRender.call(this, props, state, context);
      } finally {
        // This __PROFILE__ is used for DCE testing
        if (__PROFILE__) {
          console.profileEnd();
        }
        vnode[COMPONENT].render = originalRender;
      }
    };
    oldRender?.(vnode);
  };
}

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @license
The MIT License (MIT)

Copyright (c) 2015-present Jason Miller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
 */

import { Fragment, options } from 'preact';
import type { VNode } from 'preact';

import { DIFF, DIFFED, RENDER, ROOT } from '../renderToOpcodes/constants.js';

declare module 'preact' {
  interface Options {
    /** _root */
    __?(vnode: VNode, parent: any): void;
  }
}

interface PatchedVNode extends VNode {
  _owner?: PatchedVNode | null;

  __source?: {
    fileName: string;
    lineNumber: number;
  };
}

/**
 * Get human readable name of the component/dom node
 */
export function getDisplayName(vnode: PatchedVNode): string {
  if (vnode.type === Fragment) {
    return 'Fragment';
  } else if (typeof vnode.type == 'function') {
    return vnode.type.displayName ?? vnode.type.name;
  } else if (typeof vnode.type == 'string') {
    return vnode.type;
  }

  return '#text';
}

/**
 * Used to keep track of the currently rendered `vnode` and print it
 * in debug messages.
 */
const renderStack: PatchedVNode[] = [];

/**
 * Keep track of the current owners. An owner describes a component
 * which was responsible to render a specific `vnode`. This exclude
 * children that are passed via `props.children`, because they belong
 * to the parent owner.
 *
 * ```jsx
 * const Foo = props => <div>{props.children}</div> // div's owner is Foo
 * const Bar = props => {
 *   return (
 *     <Foo><span /></Foo> // Foo's owner is Bar, span's owner is Bar
 *   )
 * }
 * ```
 *
 * Note: A `vnode` may be hoisted to the root scope due to compiler
 * optimization. In these cases the `_owner` will be different.
 */
let ownerStack: PatchedVNode[] = [];

/**
 * Get the currently rendered `vnode`
 */
export function getCurrentVNode(): PatchedVNode | null {
  return renderStack.length > 0 ? renderStack[renderStack.length - 1]! : null;
}

/**
 * Check if a `vnode` is a possible owner.
 */
function isPossibleOwner(vnode: PatchedVNode) {
  return typeof vnode.type == 'function' && vnode.type != Fragment;
}

/**
 * Return the component stack that was captured up to this point.
 */
export function getOwnerStack(vnode: PatchedVNode): string {
  const stack = [vnode];
  let next = vnode;
  while (next._owner != null) {
    stack.push(next._owner);
    next = next._owner;
  }

  return stack.reduce((acc, owner) => {
    acc += `  in ${getDisplayName(owner)}`;

    const source = owner.__source;
    if (source) {
      acc += ` (at ${source.fileName}:${source.lineNumber})`;
    }

    return (acc += '\n');
  }, '');
}

/**
 * Setup code to capture the component trace while rendering. Note that
 * we cannot simply traverse `vnode._parent` upwards, because we have some
 * debug messages for `this.setState` where the `vnode` is `undefined`.
 */
export function setupComponentStack(): void {
  const oldDiff = options[DIFF];
  const oldDiffed = options[DIFFED];
  const oldRoot = options[ROOT];
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const oldVNode = options.vnode;
  const oldRender = options[RENDER];

  options[DIFFED] = vnode => {
    if (isPossibleOwner(vnode)) {
      ownerStack.pop();
    }
    renderStack.pop();
    if (oldDiffed) oldDiffed(vnode);
  };

  options[DIFF] = vnode => {
    if (isPossibleOwner(vnode)) {
      renderStack.push(vnode);
    }
    if (oldDiff) oldDiff(vnode);
  };

  options[ROOT] = (vnode, parent) => {
    ownerStack = [];
    if (oldRoot) oldRoot(vnode, parent);
  };

  options.vnode = (vnode: PatchedVNode) => {
    vnode._owner = ownerStack.length > 0 ? ownerStack[ownerStack.length - 1]! : null;
    if (oldVNode) oldVNode(vnode);
  };

  options[RENDER] = vnode => {
    if (isPossibleOwner(vnode)) {
      ownerStack.push(vnode);
    }

    if (oldRender) oldRender(vnode);
  };
}

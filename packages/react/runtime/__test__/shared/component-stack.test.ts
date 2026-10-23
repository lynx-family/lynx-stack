// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { VNode } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DIFF, DIFFED, RENDER, ROOT } from '../../src/shared/render-constants.js';

describe('shared/component-stack', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is idempotent and clears leaked renderStack entries on next root render or re-setup', async () => {
    const { options } = await import('preact');
    delete options[DIFF];
    delete options[DIFFED];
    delete options[ROOT];
    delete options.vnode;
    delete options[RENDER];

    const { getCurrentVNode, setupComponentStack } = await import('../../src/shared/component-stack.js');
    setupComponentStack();

    const installedDiff = options[DIFF];
    const installedDiffed = options[DIFFED];
    const installedRoot = options[ROOT];
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const installedVNode = options.vnode;
    const installedRender = options[RENDER];

    function ThrowingChild() {
      return null;
    }

    const throwingVNode = { type: ThrowingChild, props: {} } as unknown as VNode;
    options[ROOT]?.(throwingVNode, {} as never);
    options[DIFF]?.(throwingVNode);
    options[RENDER]?.(throwingVNode);
    // Simulate a component throwing during render before DIFFED runs.
    expect(getCurrentVNode()).toBe(throwingVNode);

    // Next root render must clear renderStack as well as ownerStack.
    const nextRootVNode = { type: 'view', props: {} } as unknown as VNode;
    options[ROOT]?.(nextRootVNode, {} as never);
    expect(getCurrentVNode()).toBeNull();

    // Repeated setupComponentStack() must not double-wrap hooks and must reset stacks.
    options[DIFF]?.(throwingVNode);
    expect(getCurrentVNode()).toBe(throwingVNode);
    setupComponentStack();
    expect(getCurrentVNode()).toBeNull();
    expect(options[DIFF]).toBe(installedDiff);
    expect(options[DIFFED]).toBe(installedDiffed);
    expect(options[ROOT]).toBe(installedRoot);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(options.vnode).toBe(installedVNode);
    expect(options[RENDER]).toBe(installedRender);
  });

  it('chains existing Preact option hooks and formats owner stacks across vnode types', async () => {
    const { Fragment, options } = await import('preact');
    const oldDiff = vi.fn();
    const oldDiffed = vi.fn();
    const oldRoot = vi.fn();
    const oldVNode = vi.fn();
    const oldRender = vi.fn();

    options[DIFF] = oldDiff;
    options[DIFFED] = oldDiffed;
    options[ROOT] = oldRoot;
    options.vnode = oldVNode;
    options[RENDER] = oldRender;

    const { getCurrentVNode, getOwnerStack, setupComponentStack } = await import(
      '../../src/shared/component-stack.js'
    );
    setupComponentStack();

    function Outer() {
      return null;
    }
    function NamedInner() {
      return null;
    }
    NamedInner.displayName = 'CustomInner';

    const rootVNode = { type: Outer, props: {}, __source: { fileName: 'App.tsx', lineNumber: 10 } } as unknown as VNode;
    options.vnode?.(rootVNode);
    options[ROOT]?.(rootVNode, {} as never);
    options[DIFF]?.(rootVNode);
    options[RENDER]?.(rootVNode);
    expect(getCurrentVNode()).toBe(rootVNode);

    const innerVNode = { type: NamedInner, props: {} } as unknown as VNode;
    options.vnode?.(innerVNode);
    // Cloning a vnode with an existing _owner must preserve that _owner.
    const preOwnedVNode = { type: 'view', props: {}, _owner: rootVNode } as unknown as VNode;
    options.vnode?.(preOwnedVNode);
    expect((preOwnedVNode as unknown as { _owner: unknown })._owner).toBe(rootVNode);

    options[DIFF]?.(innerVNode);
    options[RENDER]?.(innerVNode);
    expect(getCurrentVNode()).toBe(innerVNode);

    const fragmentVNode = { type: Fragment, props: {} } as unknown as VNode;
    options.vnode?.(fragmentVNode);
    options[DIFF]?.(fragmentVNode);
    options[RENDER]?.(fragmentVNode);
    options[DIFFED]?.(fragmentVNode);

    const hostVNode = { type: 'view', props: {}, _owner: fragmentVNode } as unknown as VNode;
    const textVNode = { type: null, props: {}, _owner: hostVNode } as unknown as VNode;

    expect(getOwnerStack(textVNode)).toBe(
      '  in #text\n'
        + '  in view\n'
        + '  in Fragment\n'
        + '  in CustomInner\n'
        + '  in Outer (at App.tsx:10)\n',
    );

    options[DIFFED]?.(innerVNode);
    options[DIFFED]?.(rootVNode);
    expect(getCurrentVNode()).toBeNull();

    expect(oldRoot).toHaveBeenCalledTimes(1);
    expect(oldDiff).toHaveBeenCalledTimes(3);
    expect(oldRender).toHaveBeenCalledTimes(3);
    expect(oldDiffed).toHaveBeenCalledTimes(3);
    expect(oldVNode).toHaveBeenCalledTimes(4);
  });
});

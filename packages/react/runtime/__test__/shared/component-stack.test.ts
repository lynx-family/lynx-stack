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
    expect(getCurrentVNode()).toBe(innerVNode);

    // Nested portal root render (parent with parentNode) must preserve outer stacks,
    // including when an inner portal component throws and unwinds to an outer boundary.
    const portalContextVNode = { type: Outer, props: {} } as unknown as VNode;
    const throwingPortalChildVNode = { type: NamedInner, props: {} } as unknown as VNode;
    options.vnode?.(portalContextVNode);
    options[ROOT]?.(portalContextVNode, { parentNode: {} } as never);
    expect(getCurrentVNode()).toBe(innerVNode);
    options[DIFF]?.(portalContextVNode);
    options[RENDER]?.(portalContextVNode);
    options[DIFF]?.(throwingPortalChildVNode);
    options[RENDER]?.(throwingPortalChildVNode);
    expect(getCurrentVNode()).toBe(throwingPortalChildVNode);
    // Simulate throwingPortalChildVNode and portalContextVNode skipping DIFFED
    // when an outer boundary catches the error and finishes DIFFED on innerVNode.
    options[DIFFED]?.(innerVNode);
    expect(getCurrentVNode()).toBe(rootVNode);

    // Component bailout (DIFF + DIFFED without RENDER) must not pop parent owner.
    const bailoutVNode = { type: NamedInner, props: {} } as unknown as VNode;
    options[DIFF]?.(bailoutVNode);
    expect(getCurrentVNode()).toBe(bailoutVNode);
    options[DIFFED]?.(bailoutVNode);
    expect(getCurrentVNode()).toBe(rootVNode);

    // Guard against DIFFED on a component vnode that was never pushed to renderStack.
    const unpushedVNode = { type: NamedInner, props: {} } as unknown as VNode;
    options[DIFFED]?.(unpushedVNode);
    expect(getCurrentVNode()).toBe(rootVNode);

    const postPortalChildVNode = { type: 'view', props: {} } as unknown as VNode;
    options.vnode?.(postPortalChildVNode);
    expect((postPortalChildVNode as unknown as { _owner: unknown })._owner).toBe(rootVNode);

    const hostVNode = { type: 'view', props: {}, _owner: fragmentVNode } as unknown as VNode;
    const textVNode = { type: null, props: {}, _owner: hostVNode } as unknown as VNode;

    expect(getOwnerStack(textVNode)).toBe(
      '  in #text\n'
        + '  in view\n'
        + '  in Fragment\n'
        + '  in CustomInner\n'
        + '  in Outer (at App.tsx:10)\n',
    );

    options[DIFFED]?.(rootVNode);
    expect(getCurrentVNode()).toBeNull();

    expect(oldRoot).toHaveBeenCalledTimes(2);
    expect(oldDiff).toHaveBeenCalledTimes(6);
    expect(oldRender).toHaveBeenCalledTimes(5);
    expect(oldDiffed).toHaveBeenCalledTimes(5);
    expect(oldVNode).toHaveBeenCalledTimes(6);
  });

  it('unwinds renderStack and ownerStack when a Portal child throws into an outer ErrorBoundary', async () => {
    const { Component, createElement, render } = await import('preact');
    const { createPortal } = await import('../../src/snapshot/lynx/portals.js');
    const { getCurrentVNode, setupComponentStack } = await import(
      '../../src/shared/component-stack.js'
    );
    setupComponentStack();

    class Boundary extends Component<{ children?: unknown }, { failed: boolean }> {
      override state = { failed: false };
      static override getDerivedStateFromError() {
        return { failed: true };
      }
      override render() {
        return this.state.failed ? null : this.props.children;
      }
    }

    function Boom(): null {
      throw new Error('portal boom');
    }

    const fakeTarget = {
      _nodeSelectToken: { type: 0, identifier: '#host', rootUniqueId: 0 },
    } as never;

    function App() {
      return createElement(Boundary, null, createPortal(createElement(Boom, null), fakeTarget));
    }

    const rootContainer = {
      nodeType: 1,
      childNodes: [],
      insertBefore() {},
      removeChild() {},
    } as never;

    render(createElement(App, null), rootContainer);

    expect(getCurrentVNode()).toBeNull();
    const afterRenderVNode = createElement('view', null) as unknown as { _owner?: unknown };
    expect(afterRenderVNode._owner).toBeNull();
  });
});

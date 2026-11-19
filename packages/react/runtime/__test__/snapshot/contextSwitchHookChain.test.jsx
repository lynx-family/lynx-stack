// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import { describe, expect, it, vi } from 'vitest';

import {
  createRootContext,
  defaultRootContext,
  getCurrentRootContext,
  switchRootContext,
} from '../../src/render-context';
import { installContextSwitchHook } from '../../src/snapshot/lifecycle/contextSwitchHook';
import { PARENT_DOM } from '../../src/shared/render-constants';

describe('installContextSwitchHook', () => {
  it('chains an existing renderComponent hook and installs only once', () => {
    const prev = vi.fn();
    options.renderComponent = prev;

    installContextSwitchHook();
    const installed = options.renderComponent;
    expect(installed).not.toBe(prev);

    installContextSwitchHook();
    expect(options.renderComponent).toBe(installed);

    const component = { [PARENT_DOM]: undefined };
    options.renderComponent(component, component);
    expect(prev).toHaveBeenCalledWith(component, component);
  });

  it('switches to the context carried by the rendered component owner', () => {
    installContextSwitchHook();
    const ctx = createRootContext();
    switchRootContext(defaultRootContext);

    const component = { [PARENT_DOM]: { __rootCtx: ctx } };
    options.renderComponent(component, component);
    expect(getCurrentRootContext()).toBe(ctx);

    switchRootContext(defaultRootContext);
    const orphan = { [PARENT_DOM]: {} };
    options.renderComponent(orphan, orphan);
    expect(getCurrentRootContext()).toBe(defaultRootContext);
  });
});

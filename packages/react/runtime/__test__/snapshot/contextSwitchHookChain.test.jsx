// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { options } from 'preact';
import { describe, expect, it, vi } from 'vitest';

import { installContextSwitchHook } from '../../src/snapshot/lifecycle/contextSwitchHook';

describe('installContextSwitchHook', () => {
  it('chains an existing renderComponent hook and installs only once', () => {
    const prev = vi.fn();
    options.renderComponent = prev;

    installContextSwitchHook();
    const installed = options.renderComponent;
    expect(installed).not.toBe(prev);

    installContextSwitchHook();
    expect(options.renderComponent).toBe(installed);

    const component = {};
    options.renderComponent(component, component);
    expect(prev).toHaveBeenCalledWith(component, component);
  });
});

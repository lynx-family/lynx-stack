// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, registerComponent, getComponent } from '../src/index';

// Mock the lynxApi
vi.mock('../src/lynx-api', () => ({
  lynxApi: {
    registerApp: vi.fn(),
    registerComponent: vi.fn(),
    createElement: vi.fn((type) => document.createElement(type)),
    updateElement: vi.fn(),
    removeElement: vi.fn(),
    getParent: vi.fn((element) => element.parentElement),
    appendChild: vi.fn((parent, child) => parent.appendChild(child)),
    insertBefore: vi.fn((parent, child, beforeChild) => parent.insertBefore(child, beforeChild)),
    removeChild: vi.fn((parent, child) => parent.removeChild(child)),
  },
}));

describe('Vue Lynx Integration', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.clearAllMocks();
  });

  it('should create an app', () => {
    const app = createApp({
      template: '<div>Hello Vue</div>',
    });
    expect(app).toBeDefined();
  });

  it('should mount an app', () => {
    const app = createApp({
      template: '<div>Hello Vue</div>',
    });
    const instance = app.mount('#app');
    expect(instance).toBeDefined();
  });

  it('should register a component', () => {
    const component = {
      name: 'TestComponent',
      template: '<div>Test Component</div>',
    };
    registerComponent('test-component', component);
    expect(getComponent('test-component')).toBe(component);
  });
}); 

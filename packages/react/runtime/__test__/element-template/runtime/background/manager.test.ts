// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from 'vitest';
import { BackgroundElementTemplateInstance } from '../../../../src/element-template/background/instance.js';
import { backgroundElementTemplateInstanceManager } from '../../../../src/element-template/background/manager.js';

describe('BackgroundElementTemplateInstanceManager', () => {
  beforeEach(() => {
    backgroundElementTemplateInstanceManager.clear();
    // We can't reset nextId easily without exposing it, but clear() empties the map
  });

  it('should register new instances with unique IDs', () => {
    const instance1 = new BackgroundElementTemplateInstance('view');
    const instance2 = new BackgroundElementTemplateInstance('text');

    expect(instance1.instanceId).toBeGreaterThan(0);
    expect(instance2.instanceId).toBeGreaterThan(instance1.instanceId);

    expect(backgroundElementTemplateInstanceManager.get(instance1.instanceId)).toBe(instance1);
    expect(backgroundElementTemplateInstanceManager.get(instance2.instanceId)).toBe(instance2);
  });

  it('should update ID correctly', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    const oldId = instance.instanceId;
    const newId = 10001;

    backgroundElementTemplateInstanceManager.updateId(oldId, newId);

    expect(instance.instanceId).toBe(newId);
    expect(backgroundElementTemplateInstanceManager.get(oldId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.get(newId)).toBe(instance);
  });

  it('rejects illegal handleId 0', () => {
    const instance = new BackgroundElementTemplateInstance('view');

    expect(() => backgroundElementTemplateInstanceManager.updateId(instance.instanceId, 0))
      .toThrow('ElementTemplate handleId must be a non-zero integer');
  });

  it('rejects duplicate handleId rebinding', () => {
    const first = new BackgroundElementTemplateInstance('view');
    const second = new BackgroundElementTemplateInstance('view');

    backgroundElementTemplateInstanceManager.updateId(first.instanceId, -1);

    expect(() => backgroundElementTemplateInstanceManager.updateId(second.instanceId, -1))
      .toThrow('ElementTemplate handleId -1 is already bound.');
  });

  it('rejects rebinding an unknown instance id', () => {
    expect(() => backgroundElementTemplateInstanceManager.updateId(99999, -1))
      .toThrow('ElementTemplate instance 99999 is not registered.');
  });

  it('should clear all instances', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    expect(backgroundElementTemplateInstanceManager.get(instance.instanceId)).toBe(instance);

    backgroundElementTemplateInstanceManager.clear();
    expect(backgroundElementTemplateInstanceManager.get(instance.instanceId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
  });
});

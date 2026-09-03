// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { beforeEach, describe, expect, it } from '@rstest/core';
import {
  BackgroundElementTemplateInstance,
  BackgroundPageRootInstance,
} from '../../../../src/element-template/background/instance.js';
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

  it('registers the pre-existing page root at reserved handleId 0', () => {
    const root = new BackgroundPageRootInstance();
    const ordinary = new BackgroundElementTemplateInstance('view');

    expect(root.instanceId).toBe(0);
    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(root);
    expect(ordinary.instanceId).toBeGreaterThan(0);
  });

  it('transfers the reserved handleId 0 entry to a fresh page root', () => {
    const oldRoot = new BackgroundPageRootInstance();
    const newRoot = new BackgroundPageRootInstance();

    expect(oldRoot.instanceId).toBe(0);
    expect(newRoot.instanceId).toBe(0);
    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(newRoot);

    oldRoot.tearDown();
    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(newRoot);
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
    const root = new BackgroundPageRootInstance();
    const instance = new BackgroundElementTemplateInstance('view');

    expect(() => backgroundElementTemplateInstanceManager.updateId(instance.instanceId, 0))
      .toThrow('ElementTemplate handleId must be a non-zero integer');
    expect(backgroundElementTemplateInstanceManager.get(0)).toBe(root);
    expect(backgroundElementTemplateInstanceManager.get(instance.instanceId)).toBe(instance);
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

  it('rejects invalid event values', () => {
    expect(() => backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('1:2:3:4'))
      .toThrow('Invalid ElementTemplate event value: 1:2:3:4');
  });

  it('resolves event values for spread attributes', () => {
    const handler = () => {};
    const instance = new BackgroundElementTemplateInstance('view', [{
      bindtap: handler,
    }]);

    expect(
      backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(`${instance.instanceId}:0:bindtap`),
    )
      .toBe(handler);
    expect(
      backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(`${instance.instanceId}:0:missing`),
    )
      .toBeUndefined();
  });

  it('resolves page events through the registered root attribute slot', () => {
    const handler = () => {};
    const root = new BackgroundPageRootInstance();
    root.setAuthoredPageAttributes({}, { bindtap: handler });

    expect(backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue('0:0:bindtap')).toBe(handler);
  });

  it('preserves undefined for a missing slot on a registered ordinary instance', () => {
    const instance = new BackgroundElementTemplateInstance('view', []);

    expect(
      backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(`${instance.instanceId}:0`),
    )
      .toBeUndefined();
  });

  it('ignores spread event values for non-object attributes', () => {
    const instance = new BackgroundElementTemplateInstance('view', ['plain']);

    expect(
      backgroundElementTemplateInstanceManager.getRawAttributeValueByEventValue(`${instance.instanceId}:0:bindtap`),
    )
      .toBeUndefined();
  });

  it('should clear all instances', () => {
    const instance = new BackgroundElementTemplateInstance('view');
    expect(backgroundElementTemplateInstanceManager.get(instance.instanceId)).toBe(instance);

    backgroundElementTemplateInstanceManager.clear();
    expect(backgroundElementTemplateInstanceManager.get(instance.instanceId)).toBeUndefined();
    expect(backgroundElementTemplateInstanceManager.values.size).toBe(0);
  });
});

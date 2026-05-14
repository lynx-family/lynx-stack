// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { BackgroundElementTemplateInstance } from './instance.js';

export const backgroundElementTemplateInstanceManager: {
  nextId: number;
  values: Map<number, BackgroundElementTemplateInstance>;
  register(instance: BackgroundElementTemplateInstance): void;
  updateId(oldId: number, newId: number): void;
  get(id: number): BackgroundElementTemplateInstance | undefined;
  getRawAttributeValueByEventValue(eventValue: string): unknown;
  clear(): void;
} = {
  nextId: 0,
  values: /*#__PURE__*/ new Map<number, BackgroundElementTemplateInstance>(),

  register(instance: BackgroundElementTemplateInstance): void {
    instance.instanceId = this.nextId += 1;
    this.values.set(instance.instanceId, instance);
  },

  updateId(oldId: number, newId: number): void {
    if (!Number.isInteger(newId) || newId === 0) {
      throw new Error(`ElementTemplate handleId must be a non-zero integer, got ${String(newId)}.`);
    }

    const instance = this.values.get(oldId);
    if (!instance) {
      throw new Error(`ElementTemplate instance ${oldId} is not registered.`);
    }

    const existing = this.values.get(newId);
    if (existing && existing !== instance) {
      throw new Error(`ElementTemplate handleId ${newId} is already bound.`);
    }

    if (oldId === newId) {
      return;
    }

    this.values.delete(oldId);
    instance.instanceId = newId;
    this.values.set(newId, instance);

    // DevTools event emission can be added here later
    // if (__DEV__) { ... }
  },

  get(id: number): BackgroundElementTemplateInstance | undefined {
    return this.values.get(id);
  },

  getRawAttributeValueByEventValue(eventValue: string): unknown {
    const parts = eventValue?.split(':');
    if (!parts || (parts.length !== 2 && parts.length !== 3)) {
      throw new Error('Invalid ElementTemplate event value: ' + eventValue);
    }

    const instance = this.values.get(Number(parts[0]));
    if (!instance) {
      return null;
    }

    const value = instance.getRawAttributeSlot(Number(parts[1]));
    const spreadKey = parts[2];
    if (!spreadKey) {
      return value;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    return (value as Record<string, unknown>)[spreadKey];
  },

  clear(): void {
    // Note: nextId is NOT reset to prevent ID collisions with potentially surviving instances
    // or when the clear is partial/soft reset in some scenarios.
    this.values.clear();
  },
};

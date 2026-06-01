// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { OrdinaryRefEffectQueue, SelectorRefProxy, normalizeRefValue } from '../../core/ref.js';
import type { OrdinaryRef, RefProxyForwardedMethods } from '../../core/ref.js';
import { hydrationMap } from '../hydration-map.js';
import type { SerializableValue } from '../protocol/types.js';

export type EtRef = OrdinaryRef<ElementTemplateRefProxy>;

type RefToken = [handleId: number, attrSlotIndex: number];

const refEffectQueue = /*#__PURE__*/ new OrdinaryRefEffectQueue<ElementTemplateRefProxy, RefToken>();
const delayedRefUiOps: (() => void)[] = [];
let shouldDelayRefUiOps = true;

function resolveRefHandleId(handleId: number): number {
  // The proxy may have been handed to user code before hydrate; resolve the id
  // at execution time so the same object follows the hydrated native handle.
  return hydrationMap.get(handleId) ?? handleId;
}

function runOrDelayRefUiOp(task: () => void): void {
  if (!shouldDelayRefUiOps) {
    task();
    return;
  }
  delayedRefUiOps.push(task);
}

export function getRefValue(handleId: number, attrSlotIndex: number): string {
  return `${handleId}-${attrSlotIndex}`;
}

export function flushDelayedRefUiOps(): void {
  const tasks = delayedRefUiOps.splice(0);
  shouldDelayRefUiOps = false;

  for (const task of tasks) {
    task();
  }
}

export function clearDelayedRefUiOps(): void {
  delayedRefUiOps.length = 0;
}

export class ElementTemplateRefProxy extends SelectorRefProxy<ElementTemplateRefProxy> {
  constructor(
    private readonly handleId: number,
    private readonly attrSlotIndex: number,
  ) {
    super();
    return this.createProxy();
  }

  protected createProxyTarget(): ElementTemplateRefProxy {
    return new ElementTemplateRefProxy(this.handleId, this.attrSlotIndex);
  }

  protected runOrDelay(task: () => void): void {
    runOrDelayRefUiOp(task);
  }

  get selector(): string {
    return `[ref=${getRefValue(resolveRefHandleId(this.handleId), this.attrSlotIndex)}]`;
  }
}

export interface ElementTemplateRefProxy extends RefProxyForwardedMethods<ElementTemplateRefProxy> {}

export function getRefFromValue(value: unknown): EtRef | null {
  return normalizeRefValue<ElementTemplateRefProxy>(value) ?? null;
}

function hasOwnRef(value: unknown): value is { ref?: unknown } {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, 'ref');
}

export function getSpreadRefFromValue(value: unknown): EtRef | null | undefined {
  if (!hasOwnRef(value)) {
    return undefined;
  }
  return getRefFromValue(value.ref);
}

export function prepareRefAttrSlot(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null {
  if (__LEPUS__ && value === 1) {
    // The LEPUS transform cannot carry the background ref callback/object into
    // first-screen create, so direct refs arrive here as an internal presence
    // marker. Background JS still validates the real user ref before attaching.
    return getRefValue(handleId, attrSlotIndex);
  }
  if (getRefFromValue(value) === null) {
    return null;
  }
  return getRefValue(handleId, attrSlotIndex);
}

export function prepareSpreadRefAttrValue(
  handleId: number,
  attrSlotIndex: number,
  value: unknown,
): SerializableValue | null | undefined {
  const ref = getSpreadRefFromValue(value);
  if (ref === undefined) {
    return undefined;
  }
  return ref === null ? null : getRefValue(handleId, attrSlotIndex);
}

export function queueRefAttrUpdate(
  oldValue: unknown,
  newValue: unknown,
  handleId: number,
  attrSlotIndex: number,
): void {
  const oldRef = getRefFromValue(oldValue);
  const newRef = getRefFromValue(newValue);
  refEffectQueue.queue(oldRef, newRef, [handleId, attrSlotIndex]);
}

export function flushPendingRefs(): void {
  refEffectQueue.flush(([handleId, attrSlotIndex]) => new ElementTemplateRefProxy(handleId, attrSlotIndex));
}

export function clearPendingRefs(): void {
  refEffectQueue.clear();
}

export function hasPendingRefs(): boolean {
  return refEffectQueue.hasPending();
}

export function clearRefState(): void {
  clearPendingRefs();
  hydrationMap.clear();
  clearDelayedRefUiOps();
  shouldDelayRefUiOps = true;
}

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { onWorkletCtxUpdate } from '@lynx-js/react/worklet-runtime/bindings';

import { GestureTypeInner } from './types.js';
import type { BaseGesture, ComposedGesture, GestureConfig, GestureKind } from './types.js';

function isSerializedGesture(gesture: GestureKind): boolean {
  return gesture.__isSerialized ?? false;
}

function getSerializedBaseGesture(gesture: GestureKind | undefined): BaseGesture | undefined {
  if (!gesture || !isSerializedGesture(gesture)) {
    return undefined;
  }

  if (gesture.type !== GestureTypeInner.COMPOSED) {
    return gesture as BaseGesture;
  }

  return undefined;
}

function appendUniqueSerializedBaseGestures(
  gesture: GestureKind | undefined,
  out: BaseGesture[],
  seenIds: Set<number>,
): void {
  if (!gesture || !isSerializedGesture(gesture)) {
    return;
  }

  if (gesture.type === GestureTypeInner.COMPOSED) {
    for (const subGesture of (gesture as ComposedGesture).gestures) {
      appendUniqueSerializedBaseGestures(subGesture, out, seenIds);
    }
    return;
  }

  const baseGesture = gesture as BaseGesture;
  if (seenIds.has(baseGesture.id)) {
    return;
  }
  seenIds.add(baseGesture.id);
  out.push(baseGesture);
}

function collectOldGestureInfo(
  oldGesture: GestureKind | undefined,
): {
  uniqOldBaseGestures: BaseGesture[];
  oldBaseGesturesById: Map<number, BaseGesture>;
} {
  const uniqOldBaseGestures: BaseGesture[] = [];
  const oldBaseGesturesById = new Map<number, BaseGesture>();
  appendOldGestureInfo(oldGesture, uniqOldBaseGestures, oldBaseGesturesById);

  return {
    uniqOldBaseGestures,
    oldBaseGesturesById,
  };
}

function appendOldGestureInfo(
  gesture: GestureKind | undefined,
  out: BaseGesture[],
  byId: Map<number, BaseGesture>,
): void {
  if (!gesture || !isSerializedGesture(gesture)) {
    return;
  }

  if (gesture.type === GestureTypeInner.COMPOSED) {
    for (const subGesture of (gesture as ComposedGesture).gestures) {
      appendOldGestureInfo(subGesture, out, byId);
    }
    return;
  }

  const oldBaseGesture = gesture as BaseGesture;
  if (!byId.has(oldBaseGesture.id)) {
    byId.set(oldBaseGesture.id, oldBaseGesture);
    out.push(oldBaseGesture);
  }
}

function consumeOldBaseGesture(
  baseGesture: BaseGesture,
  uniqOldBaseGestures: BaseGesture[],
  oldBaseGesturesById: Map<number, BaseGesture>,
): BaseGesture | undefined {
  const idMatchedOldBaseGesture = oldBaseGesturesById.get(baseGesture.id);
  if (idMatchedOldBaseGesture) {
    oldBaseGesturesById.delete(baseGesture.id);
    return idMatchedOldBaseGesture;
  }

  const fallbackOldBaseGesture = uniqOldBaseGestures.find(oldBaseGesture => oldBaseGesturesById.has(oldBaseGesture.id));
  if (!fallbackOldBaseGesture) {
    return undefined;
  }

  oldBaseGesturesById.delete(fallbackOldBaseGesture.id);
  return fallbackOldBaseGesture;
}

function removeGestureDetector(dom: FiberElement, id: number): void {
  // Keep compatibility with old runtimes where remove API is not exposed.
  if (typeof __RemoveGestureDetector === 'function') {
    __RemoveGestureDetector(dom, id);
  }
}

function clearLegacyGestureState(dom: FiberElement): void {
  __SetAttribute(dom, 'has-react-gesture', null);
  // `flatten` may still be required by unrelated attrs from the same spread
  // (e.g. `clip-radius`), so only clear the gesture-specific legacy state here.
  __SetAttribute(dom, 'gesture', null);
}

function getGestureInfo(
  gesture: BaseGesture,
  oldGesture: BaseGesture | undefined,
  isFirstScreen: boolean,
  dom: FiberElement,
) {
  const config = {
    callbacks: [],
  } as GestureConfig;
  const baseGesture = gesture;

  if (baseGesture.config) {
    config.config = baseGesture.config;
  }

  for (
    const key of Object.keys(baseGesture.callbacks)
  ) {
    const callback = baseGesture.callbacks[key]!;
    const oldCallback = oldGesture?.callbacks[key];
    onWorkletCtxUpdate(callback, oldCallback, isFirstScreen, dom);
    config.callbacks.push({
      name: key,
      callback: callback,
    });
  }

  const relationMap = {
    waitFor: baseGesture?.waitFor?.map(subGesture => subGesture.id) ?? [],
    simultaneous: baseGesture?.simultaneousWith?.map(subGesture => subGesture.id) ?? [],
    continueWith: baseGesture?.continueWith?.map(subGesture => subGesture.id) ?? [],
  };

  return {
    config,
    relationMap,
  };
}

export function processGesture(
  dom: FiberElement,
  gesture: GestureKind,
  oldGesture: GestureKind | undefined,
  isFirstScreen: boolean,
  gestureOptions?: {
    domSet: boolean;
  },
): void {
  const domSet = gestureOptions?.domSet === true;
  if (!gesture || !isSerializedGesture(gesture)) {
    const { oldBaseGesturesById } = collectOldGestureInfo(oldGesture);
    for (const oldBaseGesture of oldBaseGesturesById.values()) {
      removeGestureDetector(dom, oldBaseGesture.id);
    }

    // Clearing the attrs keeps the legacy main-thread state in sync when
    // gesture props disappear during spread/key-removal updates.
    if (!domSet && oldBaseGesturesById.size > 0) {
      clearLegacyGestureState(dom);
    }
    return;
  }

  const { uniqOldBaseGestures, oldBaseGesturesById } = collectOldGestureInfo(oldGesture);

  // Fast path for the most common case: single base gesture update.
  const singleBaseGesture = getSerializedBaseGesture(gesture);
  const singleOldBaseGesture = getSerializedBaseGesture(oldGesture);
  if (singleBaseGesture && (!oldGesture || singleOldBaseGesture)) {
    if (!domSet) {
      __SetAttribute(dom, 'has-react-gesture', true);
      __SetAttribute(dom, 'flatten', false);
    }

    if (singleOldBaseGesture) {
      // On update, remove old detector first to avoid stale callbacks.
      removeGestureDetector(dom, singleOldBaseGesture.id);
    }

    const { config, relationMap } = getGestureInfo(singleBaseGesture, singleOldBaseGesture, isFirstScreen, dom);
    __SetGestureDetector(
      dom,
      singleBaseGesture.id,
      singleBaseGesture.type,
      config,
      relationMap,
    );
    return;
  }

  const uniqBaseGestures: BaseGesture[] = [];
  appendUniqueSerializedBaseGestures(gesture, uniqBaseGestures, new Set<number>());

  if (uniqBaseGestures.length === 0) {
    for (const oldBaseGesture of oldBaseGesturesById.values()) {
      removeGestureDetector(dom, oldBaseGesture.id);
    }

    if (!domSet && oldBaseGesturesById.size > 0) {
      clearLegacyGestureState(dom);
    }
    return;
  }

  if (!domSet) {
    __SetAttribute(dom, 'has-react-gesture', true);
    __SetAttribute(dom, 'flatten', false);
  }

  // On update, remove old detectors first to avoid stale callbacks.
  for (const oldBaseGesture of oldBaseGesturesById.values()) {
    removeGestureDetector(dom, oldBaseGesture.id);
  }

  for (const baseGesture of uniqBaseGestures) {
    const oldBaseGesture = consumeOldBaseGesture(
      baseGesture,
      uniqOldBaseGestures,
      oldBaseGesturesById,
    );

    const { config, relationMap } = getGestureInfo(baseGesture, oldBaseGesture, isFirstScreen, dom);
    __SetGestureDetector(
      dom,
      baseGesture.id,
      baseGesture.type,
      config,
      relationMap,
    );
  }
}

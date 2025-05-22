// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { onWorkletCtxUpdate } from '@lynx-js/react/worklet-runtime/bindings';

import { GestureTypeInner } from './types.js';
import type { BaseGesture, ComposedGesture, GestureConfig, GestureKind } from './types.js';

function isSerializedGesture(gesture: GestureKind): boolean {
  return gesture.__isSerialized ?? false;
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
  if (!gesture || !isSerializedGesture(gesture)) {
    return;
  }

  if (!(gestureOptions && gestureOptions.domSet)) {
    __SetAttribute(dom, 'has-react-gesture', true);
    __SetAttribute(dom, 'flatten', false);
  }

  if (gesture.type === GestureTypeInner.COMPOSED) {
    for (const [index, subGesture] of (gesture as ComposedGesture).gestures.entries()) {
      processGesture(dom, subGesture, (oldGesture as ComposedGesture)?.gestures[index], isFirstScreen, {
        domSet: true,
      });
    }
  } else {
    const baseGesture = gesture as BaseGesture;
    const oldBaseGesture = oldGesture as BaseGesture | undefined;

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

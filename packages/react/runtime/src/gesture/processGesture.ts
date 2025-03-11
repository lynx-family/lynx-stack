import {
  type GestureKind,
  GestureTypeInner,
  type ComposedGesture,
  type BaseGesture,
  type GestureConfig,
} from './types.js';
import { onWorkletCtxUpdate } from '@lynx-js/react/worklet-runtime/bindings';

function isSerializedGesture(gesture: GestureKind): boolean {
  return gesture.__isSerialized ?? false;
}

function getGestureInfo(gesture: BaseGesture, dom: FiberElement) {
  const config = {
    callbacks: [],
  } as GestureConfig;
  const baseGesture = gesture;

  if (baseGesture.config) {
    config.config = baseGesture.config;
  }

  for (
    const key of Object.keys(baseGesture.callbacks) as Array<
      keyof BaseGesture['callbacks']
    >
  ) {
    const callback = baseGesture.callbacks[key]!;
    onWorkletCtxUpdate(callback, dom);
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
    for (const subGesture of (gesture as ComposedGesture).gestures) {
      processGesture(dom, subGesture, { domSet: true });
    }
  } else {
    const baseGesture = gesture as BaseGesture;

    const { config, relationMap } = getGestureInfo(baseGesture, dom);
    __SetGestureDetector(
      dom,
      baseGesture.id,
      baseGesture.type,
      config,
      relationMap,
    );
  }
}

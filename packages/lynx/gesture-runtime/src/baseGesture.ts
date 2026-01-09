// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type {
  BaseGestureCallbacks,
  BaseGestureConfig,
  ContinuousGestureCallbacks,
  GestureCallback,
  GestureChangeEvent,
  GestureKind,
  InternalStateManager,
  StateManager as StateManagerType,
} from './gestureInterface.js';
import { GestureTypeInner, SetGestureStateType } from './gestureInterface.js';
import { isWorkletObj } from './utils/isWorkletObject.js';
import { removeUndefined } from './utils/removeUndefined.js';

let gestureID = 0;

type WrappedCallback = (
  event: GestureChangeEvent,
  nativeStateManager: InternalStateManager,
) => void;

function wrapCallback<TEvent extends GestureChangeEvent = GestureChangeEvent>(
  cb: GestureCallback<TEvent>,
  id: number,
  name?: keyof BaseGestureCallbacks | keyof ContinuousGestureCallbacks,
): WrappedCallback {
  if (cb && !isWorkletObj(cb)) {
    throw new Error(
      `Gesture callback for '${name}' must be a main thread function.`,
    );
  }

  /* c8 ignore next -- Never reached */
  return (
    event: GestureChangeEvent,
    nativeStateManager: InternalStateManager,
  ) => {
    'main thread';
    /**
     * This should be declared inside worklet
     * So it can be a worklet accessible class declaration
     */
    class StateManager implements StateManagerType {
      gestureId: number;
      stateManager: InternalStateManager;
      event: GestureChangeEvent;

      constructor(
        id: number,
        stateManager: InternalStateManager,
        event: GestureChangeEvent,
      ) {
        this.gestureId = id;
        this.stateManager = stateManager;
        this.event = event;
      }

      fail() {
        const result = this.stateManager.__SetGestureState(
          this.event.currentTarget.element,
          this.gestureId,
          SetGestureStateType.fail,
        );
        return result;
      }

      active() {
        const result = this.stateManager.__SetGestureState(
          this.event.currentTarget.element,
          this.gestureId,
          SetGestureStateType.active,
        );
        return result;
      }

      end() {
        const result = this.stateManager.__SetGestureState(
          this.event.currentTarget.element,
          this.gestureId,
          SetGestureStateType.end,
        );
        return result;
      }

      consumeGesture(shouldConsume: boolean) {
        const result = this.stateManager.__ConsumeGesture(
          this.event.currentTarget.element,
          this.gestureId,
          { consume: shouldConsume, inner: true },
        );
        return result;
      }

      interceptGesture(
        shouldIntercept: boolean,
      ) {
        return this.stateManager.__ConsumeGesture(
          this.event.currentTarget.element,
          this.gestureId,
          { consume: shouldIntercept, inner: false },
        );
      }
    }

    return cb(event as TEvent, new StateManager(id, nativeStateManager, event));
  };
}

abstract class BaseGesture<
  TConfig extends BaseGestureConfig = BaseGestureConfig,
  TEvent extends GestureChangeEvent = GestureChangeEvent,
> implements GestureKind {
  abstract type: GestureTypeInner;
  config: TConfig = {
    enabled: true,
  } as TConfig;
  id: number;
  simultaneousWith: BaseGesture<BaseGestureConfig, GestureChangeEvent>[] = [];
  waitFor: BaseGesture<BaseGestureConfig, GestureChangeEvent>[] = [];
  continueWith: BaseGesture<BaseGestureConfig, GestureChangeEvent>[] = [];
  execId: number;
  callbacks: BaseGestureCallbacks<TEvent> = {};
  __isGesture: true = true;

  constructor(gesture?: BaseGesture<TConfig, TEvent>) {
    if (gesture) {
      this.id = gesture.id;
      this.execId = gesture.execId;
      this.config = { ...gesture.config };
      this.simultaneousWith = [...gesture.simultaneousWith];
      this.waitFor = [...gesture.waitFor];
      this.continueWith = [...gesture.continueWith];
      this.callbacks = { ...gesture.callbacks };
    } else {
      this.id = gestureID++;
      this.execId = 0;
    }
  }

  updateConfig = (k: string, v: unknown): this => {
    this.execId += 1;
    (this.config as Record<string, unknown>)[k] = v;
    return this;
  };

  updateCallback = (
    k: keyof typeof this.callbacks,
    cb: GestureCallback<TEvent>,
  ): this => {
    this.execId += 1;
    // Wrapped callback is compatible with GestureCallback<TEvent> at runtime
    this.callbacks[k] = wrapCallback<TEvent>(
      cb,
      this.id,
      k,
    ) as unknown as GestureCallback<TEvent>;
    return this;
  };

  enabled = (enabled: boolean): this => {
    return this.updateConfig('enabled', enabled);
  };

  // Gesture State Callbacks
  onBegin = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onBegin', cb);
  };

  onStart = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onStart', cb);
  };

  onEnd = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onEnd', cb);
  };
  onTouchesDown = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onTouchesDown', cb);
  };
  onTouchesMove = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onTouchesMove', cb);
  };
  onTouchesUp = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onTouchesUp', cb);
  };
  onTouchesCancel = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onTouchesCancel', cb);
  };

  externalWaitFor = (gesture: GestureKind): this => {
    if (gesture === this) {
      return this;
    }
    this.execId += 1;
    if (gesture.type === GestureTypeInner.COMPOSED) {
      this.waitFor = this.waitFor.concat(gesture.toGestureArray());
    } else {
      this.waitFor.push(
        gesture as BaseGesture<BaseGestureConfig, GestureChangeEvent>,
      );
    }
    return this;
  };

  externalSimultaneous = (gesture: GestureKind): this => {
    if (gesture === this) {
      return this;
    }
    this.execId += 1;
    if (gesture.type === GestureTypeInner.COMPOSED) {
      this.simultaneousWith = this.simultaneousWith.concat(
        gesture.toGestureArray(),
      );
    } else {
      this.simultaneousWith.push(
        gesture as BaseGesture<BaseGestureConfig, GestureChangeEvent>,
      );
    }
    return this;
  };

  externalContinueWith = (gesture: GestureKind): this => {
    if (gesture === this) {
      return this;
    }
    this.execId += 1;
    if (gesture.type === GestureTypeInner.COMPOSED) {
      this.continueWith = this.continueWith.concat(gesture.toGestureArray());
    } else {
      this.continueWith.push(
        gesture as BaseGesture<BaseGestureConfig, GestureChangeEvent>,
      );
    }
    return this;
  };

  toGestureArray = (): BaseGesture<BaseGestureConfig, GestureChangeEvent>[] => {
    return [
      this as unknown as BaseGesture<BaseGestureConfig, GestureChangeEvent>,
    ];
  };

  serialize = (): Record<string, unknown> => {
    const result = {
      config: this.config,
      id: this.id,
      type: this.type,
      simultaneousWith: this.simultaneousWith.map((gesture) => ({
        id: gesture.id,
      })),
      waitFor: this.waitFor.map((gesture) => ({ id: gesture.id })),
      continueWith: this.continueWith.map((gesture) => ({ id: gesture.id })),
      callbacks: this.callbacks,
      __isSerialized: true,
    };

    return removeUndefined(result);
  };

  toJSON = (): Record<string, unknown> => {
    return this.serialize();
  };

  clone = (): this => {
    // Create new instance
    const cloned = new (this.constructor as new(gesture?: this) => this)(this);
    Object.assign(cloned, this);

    return cloned;
  };
}

abstract class ContinuousGesture<
  TConfig extends BaseGestureConfig = BaseGestureConfig,
  TEvent extends GestureChangeEvent = GestureChangeEvent,
> extends BaseGesture<TConfig, TEvent> {
  override callbacks:
    & BaseGestureCallbacks<TEvent>
    & ContinuousGestureCallbacks<TEvent> = {};

  override updateCallback = (
    k: keyof typeof this.callbacks,
    cb: GestureCallback<TEvent>,
  ): this => {
    this.execId += 1;
    // Wrapped callback is compatible with GestureCallback<TEvent> at runtime
    this.callbacks[k] = wrapCallback<TEvent>(
      cb,
      this.id,
      k,
    ) as unknown as GestureCallback<TEvent>;
    return this;
  };

  onUpdate = (cb: GestureCallback<TEvent>): this => {
    return this.updateCallback('onUpdate', cb);
  };
}

export { BaseGesture, ContinuousGesture };
export type BaseGestureType = InstanceType<typeof BaseGesture>;

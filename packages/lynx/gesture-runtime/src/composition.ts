// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BaseGesture } from './baseGesture.js';
import type {
  BaseGestureConfig,
  GestureChangeEvent,
  GestureKind,
} from './gestureInterface.js';
import { GestureTypeInner } from './gestureInterface.js';
import type { PanGesture } from './panGesture.js';

function extendRelation(
  currentRelation:
    | BaseGesture<BaseGestureConfig, GestureChangeEvent>[]
    | undefined,
  extendWith: BaseGesture<BaseGestureConfig, GestureChangeEvent>[],
) {
  if (currentRelation === undefined) {
    return [...extendWith];
  } else {
    return [...currentRelation, ...extendWith];
  }
}

class ComposedGesture implements GestureKind {
  public gestures: GestureKind[] = [];
  simultaneousWith: BaseGesture<BaseGestureConfig, GestureChangeEvent>[] = [];
  continueWith: BaseGesture<BaseGestureConfig, GestureChangeEvent>[] = [];
  waitFor: BaseGesture<BaseGestureConfig, GestureChangeEvent>[] = [];
  type: GestureTypeInner = GestureTypeInner.COMPOSED;
  // ComposedGesture will be flatten, and should only be processed once
  panProcessed = false;
  __isGesture: true = true;

  constructor(...gestures: GestureKind[]) {
    this.gestures = gestures;
    this.prepare();
  }

  prepareSingleGesture = (
    gesture: GestureKind,
    simultaneousGestures: BaseGesture<BaseGestureConfig, GestureChangeEvent>[],
    waitFor: BaseGesture<BaseGestureConfig, GestureChangeEvent>[],
  ): void => {
    if (gesture instanceof BaseGesture) {
      gesture.simultaneousWith = extendRelation(
        gesture.simultaneousWith,
        simultaneousGestures,
      );
      gesture.waitFor = extendRelation(gesture.waitFor, waitFor);
    } else if (gesture instanceof ComposedGesture) {
      gesture.simultaneousWith = simultaneousGestures;
      gesture.waitFor = waitFor;
      gesture.prepare();
    }
  };

  prepare(): void {
    for (const gesture of this.gestures) {
      this.prepareSingleGesture(gesture, this.simultaneousWith, this.waitFor);
    }
  }

  /**
   * If pan gesture has relationship with tap or longPress, its default minDistance should be overridden
   */
  processPanDistance = (): void => {
    if (this.panProcessed) {
      return;
    }
    this.panProcessed = true;

    const gestures = this.gestures.flatMap((gesture) =>
      gesture.toGestureArray()
    );

    let hasTap = false;
    const panGestureArr: PanGesture[] = [];
    gestures.forEach((gesture) => {
      if (
        gesture.type === GestureTypeInner.LONGPRESS
        || gesture.type === GestureTypeInner.TAP
      ) {
        hasTap = true;
      } else if (gesture.type === GestureTypeInner.PAN) {
        panGestureArr.push(gesture as unknown as PanGesture);
      }
    });

    if (hasTap) {
      panGestureArr.forEach((gesture) => {
        gesture.overrideDefaultMinDistance();
      });
    }
  };

  toGestureArray = (): BaseGesture<BaseGestureConfig, GestureChangeEvent>[] => {
    return this.gestures.flatMap((gesture) => gesture.toGestureArray());
  };

  serialize = (): Record<string, unknown> => {
    return {
      type: this.type,
      gestures: this.gestures.map((gesture) => gesture.serialize()),
      __isSerialized: true,
    };
  };

  toJSON = (): Record<string, unknown> => {
    return this.serialize();
  };
}

class SimultaneousGesture extends ComposedGesture {
  override prepare(): void {
    // this piece of magic works something like this:
    // for every gesture in the array
    const simultaneousArrays = this.gestures.map((gesture) =>
      // we take the array it's in
      this.gestures
        // and make a copy without it
        .filter((x) => x !== gesture)
        // then we flatmap the result to get list of raw (not composed) gestures
        // this way we don't make the gestures simultaneous with themselves, which is
        // important when the gesture is `ExclusiveGesture` - we don't want to make
        // exclusive gestures simultaneous
        .flatMap((x) => x.toGestureArray())
    );

    this.gestures.forEach((gesture, index) => {
      if (gesture) {
        this.prepareSingleGesture(
          gesture,
          /* c8 ignore next -- Defensive coding: simultaneousArrays always matches gestures length */
          simultaneousArrays[index] ?? [],
          this.waitFor,
        );
      }
    });
  }
}

class ExclusiveGesture extends ComposedGesture {
  override prepare(): void {
    // transforms the array of gestures into array of grouped raw (not composed) gestures
    // i.e. [gesture1, gesture2, ComposedGesture(gesture3, gesture4)] -> [[gesture1], [gesture2], [gesture3, gesture4]]
    const gestureArrays = this.gestures.map((gesture) =>
      gesture.toGestureArray()
    );

    let requireToFail: BaseGesture[] = [];

    this.gestures.forEach((gesture, index) => {
      this.prepareSingleGesture(
        gesture,
        this.simultaneousWith,
        this.waitFor.concat(requireToFail),
      );

      // every group gets to wait for all groups before it

      requireToFail = requireToFail.concat(gestureArrays[index]!);
    });
  }
}

class RaceGesture extends ComposedGesture {}

export { ComposedGesture, SimultaneousGesture, ExclusiveGesture, RaceGesture };

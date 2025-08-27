// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { KeyframeEffect } from './effect.js';

export enum AnimationOperation {
  START = 0, // Start a new animation
  PLAY = 1, // Play/resume a paused animation
  PAUSE = 2, // Pause an existing animation
  CANCEL = 3, // Cancel an animation
}

export class Animation {
  static count = 0;
  public readonly effect: KeyframeEffect;
  public readonly id: string;

  constructor(effect: KeyframeEffect) {
    this.effect = effect;
    this.id = '__lynx-inner-js-animation-' + Animation.count++;
    this.start();
  }

  public cancel(): void {
    // @ts-expect-error accessing private member 'element'
    return __ElementAnimate(this.effect.target.element, [AnimationOperation.CANCEL, this.id]);
  }

  public pause(): void {
    // @ts-expect-error accessing private member 'element'
    return __ElementAnimate(this.effect.target.element, [AnimationOperation.PAUSE, this.id]);
  }

  public play(): void {
    // @ts-expect-error accessing private member 'element'
    return __ElementAnimate(this.effect.target.element, [AnimationOperation.PLAY, this.id]);
  }

  private start(): void {
    // @ts-expect-error accessing private member 'element'
    return __ElementAnimate(this.effect.target.element, [
      AnimationOperation.START,
      this.id,
      this.effect.keyframes,
      this.effect.options,
    ]);
  }
}

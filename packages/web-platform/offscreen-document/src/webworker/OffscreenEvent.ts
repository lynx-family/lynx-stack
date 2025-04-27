// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { OffscreenElement } from './OffscreenElement.js';

export const propagationStopped = Symbol('propagationStopped');
export const eventPhase = Symbol('eventPhase');

export class OffscreenEvent extends Event {
  [eventPhase]: Event['eventPhase'] = Event.CAPTURING_PHASE;
  constructor(type: string, private _target: OffscreenElement) {
    super(type);
  }

  override get target(): OffscreenElement {
    return this._target;
  }

  [propagationStopped] = false;

  override stopImmediatePropagation(): void {
    this[propagationStopped] = true;
    super.stopImmediatePropagation();
  }

  override stopPropagation(): void {
    this[propagationStopped] = true;
    super.stopPropagation();
  }

  override get eventPhase() {
    return this[eventPhase];
  }
}

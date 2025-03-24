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

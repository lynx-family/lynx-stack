export const counterUpdatedEventName = 'CounterUpdated';
export const destroyLifetimeEventName = '__DestroyLifetime';
export const incrementCounterEventName = 'IncrementCounter';

export interface CounterPatch {
  count: number;
}

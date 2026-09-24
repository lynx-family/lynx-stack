export const counterUpdatedEventName = 'CounterUpdated';
export const incrementCounterEventName = 'IncrementCounter';

export interface CounterPatch {
  count: number;
}

export interface EventsFromBackground {
  [counterUpdatedEventName]: CounterPatch;
}

export interface EventsToBackground {
  [incrementCounterEventName]: undefined;
}

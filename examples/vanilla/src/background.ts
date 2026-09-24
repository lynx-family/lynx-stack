import { initializeBackgroundThread } from '@lynx-js/lynx-runtime/background';

import type {
  CounterPatch,
  EventsFromBackground,
  EventsToBackground,
} from './events.js';
import {
  counterUpdatedEventName,
  incrementCounterEventName,
} from './events.js';

let count = 0;

function onIncrementCounter(): void {
  count += 1;

  const patch: CounterPatch = { count };
  runtime.dispatchToMainThread(counterUpdatedEventName, patch);
}

const runtime = initializeBackgroundThread<
  EventsFromBackground,
  EventsToBackground
>();

runtime.onMainThreadEvent(incrementCounterEventName, onIncrementCounter);

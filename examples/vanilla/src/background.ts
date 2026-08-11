import type { CounterPatch } from './events.js';
import {
  counterUpdatedEventName,
  destroyLifetimeEventName,
  incrementCounterEventName,
} from './events.js';

const mainThread = lynx.getCoreContext();

let count = 0;

function onIncrementCounter(): void {
  count += 1;

  const patch: CounterPatch = { count };
  mainThread.dispatchEvent({
    type: counterUpdatedEventName,
    data: patch,
  });
}

function cleanup(): void {
  mainThread.removeEventListener(
    incrementCounterEventName,
    onIncrementCounter,
  );
  mainThread.removeEventListener(destroyLifetimeEventName, cleanup);
}

mainThread.addEventListener(incrementCounterEventName, onIncrementCounter);
mainThread.addEventListener(destroyLifetimeEventName, cleanup);

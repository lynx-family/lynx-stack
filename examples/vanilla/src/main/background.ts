import { bindPage } from '@lynx-js/lynx-runtime/bts';

import type { CounterPatch } from './events.js';
import {
  counterUpdatedEventName,
  incrementCounterEventName,
} from './events.js';

export function setUpBackgroundThread(): void {
  const page = bindPage();
  let count = 0;

  const stopMessage = page.onMessage(incrementCounterEventName, () => {
    count += 1;

    page.sendMessage<CounterPatch>(counterUpdatedEventName, { count });
  });

  const stopDestroy = page.onDestroy(() => {
    stopMessage();
    stopDestroy();
  });
}

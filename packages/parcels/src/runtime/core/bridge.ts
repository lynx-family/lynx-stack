// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { prepareParcelBackground } from './background.js';
import type { ParcelSource } from './types.js';

const prepareEvent = 'LynxParcel:prepare';

export function dispatchParcelBackground(
  source: ParcelSource,
  replyEvent: string,
): void {
  lynx.getJSContext().dispatchEvent({
    type: prepareEvent,
    data: { source, replyEvent },
  });
}

/** Register the parcel listener at background startup and return its cleanup function. */
export function installParcelBackground(): () => void {
  const context = lynx.getCoreContext();
  context.addEventListener(prepareEvent, prepare);
  return () => context.removeEventListener(prepareEvent, prepare);
}

function prepare(
  event: { data: { source: ParcelSource; replyEvent: string } },
): void {
  prepareParcelBackground(event.data.source, event.data.replyEvent);
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { prepareIslandBackground } from './prepare-background.js';
import type { IslandReference } from './types.js';

const prepareEvent = 'LynxIsland:prepare';

export function dispatchIslandBackground(
  source: IslandReference,
  replyEvent: string,
): void {
  lynx.getJSContext().dispatchEvent({
    type: prepareEvent,
    data: { source, replyEvent },
  });
}

/** Register the island listener at background startup and return its cleanup function.
 * @internal
 */
export function installIslandBackground(): () => void {
  const context = lynx.getCoreContext();
  context.addEventListener(prepareEvent, prepare);
  return () => context.removeEventListener(prepareEvent, prepare);
}

function prepare(
  event: { data: { source: IslandReference; replyEvent: string } },
): void {
  prepareIslandBackground(event.data.source, event.data.replyEvent);
}

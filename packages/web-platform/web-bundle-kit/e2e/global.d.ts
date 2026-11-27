// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// What `e2e/page/page.js` puts on `window`.

import type { BuildEvent } from '../src/types.js';

declare global {
  interface Window {
    /** Set when the page is ready. */
    ready?: true;
    /** Calls a method of `e2e/page/worker.js`. */
    kit(method: string, ...args: unknown[]): Promise<unknown>;
    /** The events of the current `watch()`, as the Worker posts them. */
    kitEvents: BuildEvent[];
    /** Native module calls and errors of the rendered card. */
    cardEvents: { type: string; message: string }[];
    /** Renders a bundle in a new <lynx-view>. */
    render(url: string): HTMLElement;
    /** Sends the rendered card the signals of a dev server for `hash`. */
    hotUpdate(hash: string): void;
  }
}

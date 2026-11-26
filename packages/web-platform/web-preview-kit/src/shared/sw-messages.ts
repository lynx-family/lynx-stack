// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Page to Service Worker. */
export type ServiceWorkerMessage =
  /**
   * Records the sending page as the owner of an instance, so that the
   * instance's cache is removed once the page is gone. The Service Worker
   * answers on the transferred port when it is done.
   */
  { type: 'claim'; instanceId: string };

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * {@inheritdoc Dev.client}
 *
 * @public
 */
export interface Client {
  /**
   * The path to websocket.
   *
   * @defaultValue `require.resolve('@lynx-js/websocket')`
   */
  websocketTransport?: string | undefined
}

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { DebugRouterConnector } from './connector.ts';
import type { Context } from './tools/defineTool.ts';

export class McpContext implements Context {
  #connector: DebugRouterConnector;

  constructor(connector: DebugRouterConnector) {
    this.#connector = connector;
  }

  static withConnector(
    connector: DebugRouterConnector,
  ): Promise<McpContext> {
    return Promise.resolve(new McpContext(connector));
  }

  connector(): DebugRouterConnector {
    return this.#connector;
  }
}

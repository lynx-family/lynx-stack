// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Connector } from '@lynx-js/devtool-connector';

import type { Context } from './tools/defineTool.ts';

export class McpContext implements Context {
  #connector: Connector;

  constructor(connector: Connector) {
    this.#connector = connector;
  }

  static withConnector(connector: Connector): Promise<McpContext> {
    return Promise.resolve(new McpContext(connector));
  }

  connector(): Connector {
    return this.#connector;
  }
}

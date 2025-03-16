// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { createRpcEndpoint } from '@lynx-js/web-worker-rpc';
import { StyleManager } from './styleManager.js';

export const styleEndpoint = createRpcEndpoint<[StyleMessage], void>(
  'style',
  false,
  true,
);

interface StyleMessage {
  type: 'add' | 'update' | 'remove';
  selector: string;
  styles?: Record<string, string>;
  mediaQuery?: string;
}

export function registerStyleHandler(rpc: Rpc) {
  const styleManager = new StyleManager();

  rpc.registerHandler(styleEndpoint, (message: StyleMessage) => {
    const { type, selector, styles, mediaQuery } = message;

    switch (type) {
      case 'add':
        if (styles) {
          styleManager.addRule({ selector, styles, mediaQuery });
        }
        break;
      case 'update':
        if (styles) {
          styleManager.updateRule({ selector, styles, mediaQuery });
        }
        break;
      case 'remove':
        styleManager.removeRule(selector, mediaQuery);
        break;
    }
  });

  return styleManager;
}

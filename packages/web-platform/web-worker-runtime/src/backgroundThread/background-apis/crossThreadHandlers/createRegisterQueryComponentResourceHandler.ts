// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  queryComponentResourceEndpoint,
  type LynxTemplate,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

const templateCache: Record<string, LynxTemplate> = {};

export function createRegisterQueryComponentResourceHandler(rpc: Rpc) {
  const callbacks: Array<
    { source: string; callback: (template: LynxTemplate) => void }
  > = [];
  rpc.registerHandler(
    queryComponentResourceEndpoint,
    (source, template) => {
      templateCache[source] = template;
      let i = 0;
      while (i < callbacks.length) {
        const { source: rawSource, callback } = callbacks[i]!;
        if (source === rawSource) {
          callback(template);
          callbacks.splice(i, 1);
        } else {
          i++;
        }
      }
    },
  );

  return {
    registerQueryComponentResourceHandler: (
      source: string,
      callback: (template: LynxTemplate) => void,
    ) => {
      // If the resource has been passed from QueryComponentResource but not from mts, callback directly.
      if (templateCache[source]) {
        callback(templateCache[source]);
        return;
      }
      // If the resource has not been passed from QueryComponentResource but not from mts, push callbacks and then it will be triggered through registerHandler
      callbacks.push({ source, callback });
    },
    templateCache,
  };
}

// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  btsQueryComponentEndpoint,
  type LynxTemplate,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerBtsQueryComponent(
  backgroundRpc: Rpc,
  triggerMtsQueryComponentTemplate: (
    source: string,
    template: LynxTemplate,
  ) => void,
  callback: (source: string) => Promise<LynxTemplate>,
) {
  backgroundRpc.registerHandler(
    btsQueryComponentEndpoint,
    (source: string, id: number) =>
      callback(source).then(template => {
        triggerMtsQueryComponentTemplate(source, template);
        return { template, source, id };
      }),
  );
}

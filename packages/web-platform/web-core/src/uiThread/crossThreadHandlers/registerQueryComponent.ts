// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  queryComponentEndpoint,
  type LynxTemplate,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

interface RegisterQueryComponent {
  mainThreadRpc?: Rpc;
  backgroundRpc: Rpc;
  getTemplate: (source: string) => Promise<LynxTemplate>;
  triggerQueryComponentTemplate: (ret: {
    source: string;
    template?: LynxTemplate;
  }) => void;
}

export function registerQueryComponent(
  {
    mainThreadRpc,
    backgroundRpc,
    getTemplate,
    triggerQueryComponentTemplate,
  }: RegisterQueryComponent,
) {
  // only multi-thread will pass mainThreadRpc
  if (mainThreadRpc) {
    mainThreadRpc.registerHandler(queryComponentEndpoint, (source) => {
      getTemplate(source).then(template => {
        triggerQueryComponentTemplate({ source, template });
      });
    });
  }
  registerBtsQueryComponent(
    backgroundRpc,
    getTemplate,
    triggerQueryComponentTemplate,
  );
}

function registerBtsQueryComponent(
  backgroundRpc: Rpc,
  getTemplate: (source: string) => Promise<LynxTemplate>,
  triggerQueryComponentTemplate: (ret: {
    source: string;
    template?: LynxTemplate;
  }) => void,
) {
  backgroundRpc.registerHandler(
    queryComponentEndpoint,
    (source: string) => {
      getTemplate(source).then(template => {
        triggerQueryComponentTemplate({ source, template });
      });
    },
  );
}

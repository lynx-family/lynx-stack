// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  queryComponentTemplateEndpoint,
  type LynxTemplate,
  type NativeApp,
} from '@lynx-js/web-constants';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerQueryComponentTemplate(
  rpc: Rpc,
  queryComponentCallbacks: Record<
    string,
    Array<
      (
        ret: { __hasReady: boolean } | {
          code: number;
          detail?: { schema: string };
        },
      ) => void
    >
  >,
  templateCache: Record<string, LynxTemplate | undefined>,
  nativeApp: NativeApp,
): void {
  rpc.registerHandler(
    queryComponentTemplateEndpoint,
    (source, template) => {
      const callbacks = queryComponentCallbacks[source] ?? [];
      if (!template) {
        callbacks.forEach(cb => cb?.({ code: -1 }));
      } else {
        templateCache[source] = template;
        const exports =
          (nativeApp.loadScript(template.manifest['/app-service.js']))
            .init;
        const factory = exports.bind(exports);
        factory({ tt: nativeApp.tt! });
        callbacks.forEach(cb => cb?.({ __hasReady: true }));
      }
      delete queryComponentCallbacks[source];
    },
  );
}

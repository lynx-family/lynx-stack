// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { queryComponentTemplateEndpoint } from '@lynx-js/web-constants';
import { executeTemplateEntry } from '@lynx-js/web-mainthread-apis';
import type { ExecuteTemplateEntry } from '@lynx-js/web-mainthread-apis/src/utils/processStyleInfo.js';
import type { Rpc } from '@lynx-js/web-worker-rpc';

export function registerQueryComponentTemplate(
  rpc: Rpc,
  executeOptions: Omit<ExecuteTemplateEntry, 'template' | 'source'>,
): void {
  rpc.registerHandler(
    queryComponentTemplateEndpoint,
    (source, template) => {
      if (!template) return;
      executeTemplateEntry({ ...executeOptions, template, source });
    },
  );
}

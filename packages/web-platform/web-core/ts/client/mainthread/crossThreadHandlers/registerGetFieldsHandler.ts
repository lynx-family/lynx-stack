// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { ErrorCode } from '../../../constants.js';
import type { FieldsCallbackRes } from '../../../types/index.js';
import { getFieldsEndpoint } from '../../endpoints.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';
import { queryNodes } from './queryNodes.js';

export function registerGetFieldsHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  rpc.registerHandler(
    getFieldsEndpoint,
    (
      type,
      identifier,
      component_id,
      first_only,
      fields,
      root_unique_id,
    ): FieldsCallbackRes => {
      const results: Record<string, unknown>[] = [];
      let status = { code: ErrorCode.SUCCESS, data: 'success' };
      const apis = lynxViewInstance.mainThreadGlobalThis;
      queryNodes(
        lynxViewInstance,
        type,
        identifier,
        component_id,
        first_only,
        root_unique_id,
        (element) => {
          const node = element as HTMLElement;
          const data: Record<string, unknown> = {};
          for (const field of fields) {
            switch (field) {
              case 'id':
                data['id'] = apis.__GetID(node) ?? '';
                break;
              case 'dataset':
                data['dataset'] = apis.__GetDataset(node);
                break;
              case 'tag':
                data['tag'] = apis.__GetTag(node);
                break;
            }
          }
          results.push(data);
        },
        (code) => {
          status = {
            code,
            data: code === ErrorCode.NODE_NOT_FOUND
              ? 'node not found'
              : 'selector not supported',
          };
        },
      );
      return { data: first_only ? results[0] ?? null : results, status };
    },
  );
}

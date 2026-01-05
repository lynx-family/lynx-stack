// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rpc } from '@lynx-js/web-worker-rpc';
import { queryNodes } from './queryNodes.js';
import { getPathInfoEndpoint } from '../../endpoints.js';
import type { Cloneable, InvokeCallbackRes } from '../../../types/index.js';
import { ErrorCode } from '../../../constants.js';
import type { LynxViewInstance } from '../LynxViewInstance.js';

type OneNodeInfo = {
  tag: string;
  id?: string;
  class?: string;
  dataSet?: Record<string, Cloneable>;
  index: number; // The index of the node in the parent element's children
};

type PathInfo = {
  /**
   * The order of the nodes in the path from the the target node to the root node.
   */
  path: OneNodeInfo[];
};

export function registerGetPathInfoHandler(
  rpc: Rpc,
  lynxViewInstance: LynxViewInstance,
) {
  rpc.registerHandler(
    getPathInfoEndpoint,
    (
      type,
      identifier,
      component_id,
      first_only,
      root_unique_id,
    ): InvokeCallbackRes => {
      let code = ErrorCode.UNKNOWN;
      let data: PathInfo | undefined;

      queryNodes(
        lynxViewInstance,
        type,
        identifier,
        component_id,
        first_only,
        root_unique_id,
        (element) => {
          try {
            const path: OneNodeInfo[] = [];
            let currentNode: HTMLElement | null = element as HTMLElement;
            while (currentNode) {
              const parent: HTMLElement | null = currentNode.parentElement;
              const parentNodeForChildren = parent ?? lynxViewInstance.rootDom;
              const children = Array.from(parentNodeForChildren.children);
              const tag = lynxViewInstance.mainThreadGlobalThis.__GetTag(
                currentNode,
              );
              const index = tag === 'page' ? 0 : children.indexOf(currentNode);
              const id = currentNode.getAttribute('id') || undefined;
              const className = currentNode.getAttribute('class') || undefined;
              const dataSet = lynxViewInstance.mainThreadGlobalThis
                .__GetDataset(currentNode);
              path.push({
                tag,
                id,
                class: className,
                dataSet,
                index,
              });
              if (
                tag === 'page'
                || currentNode.parentNode === lynxViewInstance.rootDom
              ) {
                break;
              }
              currentNode = parent;
            }
            data = { path };
            code = ErrorCode.SUCCESS;
          } catch (e) {
            console.error('[lynx-web] getPathInfo: failed with', e, element);
            code = ErrorCode.UNKNOWN;
          }
        },
        (error) => {
          code = error;
        },
      );
      return { code, data };
    },
  );
}

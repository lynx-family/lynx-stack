// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Rpc } from '@lynx-js/web-worker-rpc';
import {
  ErrorCode,
  getPathInfoEndpoint,
  lynxDatasetAttribute,
  lynxTagAttribute,
} from '@lynx-js/web-constants';
import type { InvokeCallbackRes } from '@lynx-js/web-constants';
import { queryNodes } from './queryNodes.js';

type OneNodeInfo = {
  tag: string;
  id?: string;
  class?: string;
  dataSet?: Record<string, string>;
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
  shadowRoot: ShadowRoot,
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
        shadowRoot,
        type,
        identifier,
        component_id,
        first_only,
        root_unique_id,
        (element) => {
          try {
            const path: OneNodeInfo[] = [];
            let currentNode: Element | null = element;
            while (currentNode) {
              const parent: HTMLElement | null = currentNode.parentElement;
              const parentNodeForChildren = parent ?? shadowRoot;
              const children = Array.from(parentNodeForChildren.children);
              const tag = currentNode.getAttribute(lynxTagAttribute)!;
              const index = tag === 'page' ? 0 : children.indexOf(currentNode);
              const id = currentNode.getAttribute('id') || undefined;
              const className = currentNode.getAttribute('class') || undefined;
              const datasetString = currentNode.getAttribute(
                lynxDatasetAttribute,
              );
              const dataSet = datasetString
                ? JSON.parse(decodeURIComponent(datasetString))
                : undefined;

              path.push({
                tag,
                id,
                class: className,
                dataSet,
                index,
              });
              if (tag === 'page' || currentNode.parentNode === shadowRoot) {
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

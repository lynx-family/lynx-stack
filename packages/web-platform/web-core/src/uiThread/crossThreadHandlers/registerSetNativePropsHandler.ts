// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Rpc } from '@lynx-js/web-worker-rpc';
import { queryNodes } from './queryNodes.js';
import { setNativePropsEndpoint } from '@lynx-js/web-constants';

function applyNativeProps(element: Element, nativeProps: Record<string, any>) {
  for (const key in nativeProps) {
    const value = nativeProps[key] as string;
    if (key === 'text' && element?.tagName === 'X-TEXT') {
      if (
        element.firstElementChild
        && element.firstElementChild.tagName == 'RAW-TEXT'
      ) {
        element = element.firstElementChild;
      }
    }
    if (
      CSS.supports(key, value)
      && (element as HTMLElement).style
    ) {
      (element as HTMLElement).style.setProperty(key, value);
    } else {
      element.setAttribute(key, value);
    }
  }
}

export function registerNativePropsHandler(
  rpc: Rpc,
  shadowRoot: ShadowRoot,
) {
  rpc.registerHandler(
    setNativePropsEndpoint,
    (
      type,
      identifier,
      component_id,
      first_only,
      native_props,
      root_unique_id,
    ) => {
      queryNodes(
        shadowRoot,
        type,
        identifier,
        component_id,
        first_only,
        root_unique_id,
        (element) => {
          applyNativeProps(element, native_props);
        },
      );
    },
  );
}

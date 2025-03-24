// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  componentIdAttribute,
  ErrorCode,
  IdentifierType,
  lynxUniqueIdAttribute,
} from '@lynx-js/web-constants';

export function queryNodes(
  shadowRoot: ShadowRoot,
  type: IdentifierType,
  identifier: string,
  component_id: string,
  first_only: boolean,
  root_unique_id: number | undefined,
  callback: (dom: Element) => void,
  error?: (code: ErrorCode) => void,
) {
  let queryRoot: ShadowRoot | Element = shadowRoot;
  if (root_unique_id) {
    const root = shadowRoot.querySelector(
      `[${lynxUniqueIdAttribute}="${root_unique_id}"]`,
    );
    if (root) {
      queryRoot = root;
    } else {
      console.error(
        `[lynx-web] cannot find dom for root_unique_id: ${root_unique_id}`,
      );
      error?.(ErrorCode.NODE_NOT_FOUND);
      return;
    }
  } else if (component_id) {
    const root = shadowRoot.querySelector(
      `[${componentIdAttribute}="${component_id}"]`,
    );
    if (root) {
      queryRoot = root;
    } else {
      console.error(
        `[lynx-web] cannot find dom for component_id: ${component_id}`,
      );
      error?.(ErrorCode.NODE_NOT_FOUND);
      return;
    }
  }
  let selector: string;
  if (type === IdentifierType.ID_SELECTOR) {
    selector = identifier;
  } else if (type === IdentifierType.UNIQUE_ID) {
    selector = `[${lynxUniqueIdAttribute}="${identifier}"]`;
  } else {
    console.error(`[lynx-web] NYI: setnativeprops type ${type}`);
    error?.(ErrorCode.UNKNOWN);
    return;
  }
  if (first_only) {
    let targetElement: Element | null = null;
    try {
      targetElement = queryRoot.querySelector(selector);
    } catch (e) {
      console.error(`[lynx-web] cannot use selector: ${selector}`);
      error?.(ErrorCode.SELECTOR_NOT_SUPPORTED);
      return;
    }

    if (targetElement) {
      callback(targetElement);
    } else {
      console.error(
        `[lynx-web] cannot find from for selector ${identifier} under`,
        queryRoot,
      );
      error?.(ErrorCode.NODE_NOT_FOUND);
    }
  } else {
    queryRoot.querySelectorAll(selector).forEach((element) => {
      callback(element);
    });
  }
}

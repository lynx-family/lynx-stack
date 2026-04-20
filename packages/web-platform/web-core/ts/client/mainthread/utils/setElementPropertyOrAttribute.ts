// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const setElementPropertyOrAttribute = (
  element: Element,
  key: string,
  value: unknown,
) => {
  if (value == null) {
    element.removeAttribute(key);
    return;
  }

  if (
    key in element
    && typeof value !== 'string'
    && typeof value !== 'number'
    && typeof value !== 'boolean'
  ) {
    (element as unknown as Record<string, unknown>)[key] = value;
  } else {
    element.setAttribute(key, String(value));
  }
};

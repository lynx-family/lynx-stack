// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { CssOGInfo } from '@lynx-js/web-constants';

/**
 * @param classes
 * @param styleInfo it should be flattened, which means there is no imports field in the styleInfo
 * @param cssId
 * @returns
 */
export function decodeCssOG(
  classes: string,
  styleInfo: CssOGInfo,
  cssId: string | null,
) {
  const classList = classes.split(' ').filter(e => e);
  let declarations: [string, string][] = [];
  const currentStyleInfo = styleInfo[cssId ?? '0'];
  if (currentStyleInfo) {
    for (const oneClassName of classList) {
      const oneRule = currentStyleInfo[oneClassName];
      if (oneRule) declarations.push(...oneRule);
    }
  } else {
    console.warn(`[lynx-web] cannot find styleinfo for cssid ${cssId}`);
  }
  return declarations.map(([property, value]) => `${property}:${value};`).join(
    '',
  );
}

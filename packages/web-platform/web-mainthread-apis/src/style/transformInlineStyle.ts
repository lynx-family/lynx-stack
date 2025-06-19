// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as tokenizer from '../utils/tokenizer.js';
import { transformLynxStyles } from '@lynx-js/web-style-transformer';
function parseStyleStringToObject(str: string) {
  const hyphenNameStyles: [property: string, value: string][] = [];
  tokenizer.parseInlineStyle(
    str,
    (
      name_start: number,
      name_end: number,
      value_start: number,
      value_end: number,
      isImportant: boolean,
    ) => {
      hyphenNameStyles.push([
        str.substring(name_start, name_end),
        str.substring(value_start, value_end)
        + (isImportant ? ' !important' : ''),
      ]);
    },
  );
  return hyphenNameStyles;
}

export function transformInlineStyleString(str: string) {
  return transformParsedStyles(parseStyleStringToObject(str));
}

export function transformParsedStyles(
  hyphenatedStyleObject: [property: string, value: string][],
) {
  return transformLynxStyles(hyphenatedStyleObject);
}

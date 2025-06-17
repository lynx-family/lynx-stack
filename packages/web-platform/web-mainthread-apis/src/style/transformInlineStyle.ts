// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as tokenizer from '../utils/tokenizer.js';
import { transformLynxStyles } from '@lynx-js/web-style-transformer';
function parseStyleStringToObject(str: string) {
  const hyphenNameStyles: [property: string, value: string][] = [];
  let beforeColonToken = true;
  let propertyStart = 0;
  let propertyEnd = 0;
  let valueStart = 0;
  let valueEnd = 0;
  tokenizer.tokenize(str + ';', (type: number, start: number, end: number) => {
    if (type === tokenizer.Semicolon || tokenizer.EOF) {
      valueEnd = start;
      const trimmedProperty = str.substring(propertyStart, propertyEnd).trim();
      const trimmedValue = str.substring(valueStart, valueEnd).trim();
      if (!beforeColonToken && trimmedValue && trimmedProperty) {
        hyphenNameStyles.push([
          trimmedProperty,
          trimmedValue,
        ]);
      }
      beforeColonToken = true;
      propertyStart = end;
    } else if (type === tokenizer.Colon && beforeColonToken) {
      beforeColonToken = false;
      valueStart = end;
      propertyEnd = start;
    }
  });
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

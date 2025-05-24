// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as tokenizer from '../../utils/tokenizer.js';
import { transformLynxStyles } from '@lynx-js/web-style-transformer';
function parseStyleStringToObject(str: string) {
  return tokenizer.parseInlineStyle(str + ';');
}

export function transformInlineStyleString(str: string) {
  return transfromParsedStyles(parseStyleStringToObject(str));
}

export function transfromParsedStyles(
  hyphenatedStyleObject: [property: string, value: string][],
) {
  return transformLynxStyles(hyphenatedStyleObject);
}

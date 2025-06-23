// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export { transformInlineStyleString } from '../utils/tokenizer.js';
import { transformLynxStyles } from '@lynx-js/web-style-transformer';

export function transformParsedStyles(
  hyphenatedStyleObject: [property: string, value: string][],
) {
  return transformLynxStyles(hyphenatedStyleObject);
}

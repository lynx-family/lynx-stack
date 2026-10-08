// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface CSSRule {
  sel: string[][][];
  decl: [string, string][];
}
/**
 * A `@media` group: `rules` apply only while the `media` query list matches.
 */
export interface CSSMediaRule {
  media: string;
  rules: (CSSRule | CSSMediaRule)[];
}
export interface OneInfo {
  content: string[];
  rules: (CSSRule | CSSMediaRule)[];
  imports?: string[];
}
export type StyleInfo = Record<string, OneInfo>;

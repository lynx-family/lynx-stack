// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface CSSRule {
  sel: [
    plainSelectors: string[],
    pseudoClassSelectors: string[],
    pseudoElementSelectors: string[],
    combinator: string[],
    ...string[][],
  ][];
  decl: [string, string][];
}
export interface OneInfo {
  content: string[];
  rules: CSSRule[];
  imports?: string[];
}
export interface StyleInfo {
  [cssId: string]: OneInfo;
}

export interface CssInJsInfo {
  [cssId: string]: {
    [className: string]: [string, string][];
  };
}

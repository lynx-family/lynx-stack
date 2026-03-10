// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface PageConfig {
  enableCSSSelector: 'true' | 'false';
  enableRemoveCSSScope: 'true' | 'false';
  defaultDisplayLinear: 'true' | 'false';
  defaultOverflowVisible: 'true' | 'false';
  enableJSDataProcessor: 'true' | 'false';
  isLazy: 'true' | 'false';
  cardType: string;
}

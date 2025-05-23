// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';
import type { LynxTemplate } from './LynxModule.js';
import type { NapiModulesMap } from './NapiModules.js';
import type { NativeModulesMap } from './NativeModules.js';
import type { BrowserConfig } from './PageConfig.js';

export interface StartMainThreadContextConfig {
  template: LynxTemplate;
  initData: Cloneable;
  globalProps: Cloneable;
  browserConfig: BrowserConfig;
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
  tagMap: Record<string, string>;
}

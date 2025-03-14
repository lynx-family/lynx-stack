// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';
import type { LynxTemplate } from './LynxModule.js';
import type { NapiModulesMap } from './NapiModules.js';
import type { BrowserConfig } from './PageConfig.js';

export interface MainThreadStartConfigs {
  template: LynxTemplate;
  initData: Cloneable;
  globalProps: Cloneable;
  entryId: string;
  browserConfig: BrowserConfig;
  nativeModulesUrl?: string;
  napiModulesMap: NapiModulesMap;
}

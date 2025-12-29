// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Cloneable } from './Cloneable.js';
import type { LynxTemplate } from './LynxModule.js';
import type { NapiModulesMap } from './NapiModules.js';
import type { NativeModulesMap } from './NativeModules.js';

export interface BackMainThreadContextConfig {
  initData: unknown;
  globalProps: unknown;
  template: LynxTemplate;
  cardType: string;
  customSections: Record<string, Cloneable>;
  nativeModulesMap: NativeModulesMap;
  napiModulesMap: NapiModulesMap;
}

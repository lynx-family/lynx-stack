// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxViewElement } from '../client/index.js';
import type { Cloneable } from './Cloneable.js';

export type NapiModulesMap = Record<string, string>;

export type NapiModulesCall = (
  name: string,
  data: any,
  moduleName: string,
  lynxView: LynxViewElement,
  dispatchNapiModules: (data: Cloneable) => void,
) =>
  | Promise<{ data: unknown; transfer?: Transferable[] } | undefined>
  | {
    data: unknown;
    transfer?: Transferable[];
  }
  | undefined
  | Promise<undefined>;

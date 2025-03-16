// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export type NapiModulesMap = Record<string, string>;

export type NapiModulesCall = (
  name: string,
  data: any,
  moduleName: string,
) => Promise<any> | any;

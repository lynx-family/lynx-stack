// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
interface ISystemInfo {
  osVersion: string;
  pixelHeight: number;
  pixelRatio: number;
  pixelWidth: number;
  platform: string;
  theme: object;
  /**
   * The version of the Lynx SDK.
   * @since Lynx 2.4
   * @example '2.4', '2.10'
   */
  lynxSdkVersion?: string;
}

declare let SystemInfo: ISystemInfo;

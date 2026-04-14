// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function isSdkVersionGt(major: number, minor: number): boolean {
  const lynxSdkVersion: string = SystemInfo.lynxSdkVersion ?? '1.0';
  const version = lynxSdkVersion.split('.');
  return (
    Number(version[0]) > major
    || (Number(version[0]) == major && Number(version[1]) > minor)
  );
}

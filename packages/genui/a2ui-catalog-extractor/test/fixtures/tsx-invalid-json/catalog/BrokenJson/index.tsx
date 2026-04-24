// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface BrokenJsonProps {
  /**
   * Invalid JSON default.
   * @defaultValue {"broken":}
   */
  value?: string;
}

export function BrokenJson(_props: BrokenJsonProps): null {
  return null;
}

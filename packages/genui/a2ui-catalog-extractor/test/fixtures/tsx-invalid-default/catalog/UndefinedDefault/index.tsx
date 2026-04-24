// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface UndefinedDefaultProps {
  /**
   * Invalid default marker.
   * @defaultValue undefined
   */
  value?: string;
}

export function UndefinedDefault(_props: UndefinedDefaultProps): null {
  return null;
}

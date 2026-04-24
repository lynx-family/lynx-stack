// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export interface BrokenProps {
  /**
   * Invalid schema override.
   * @a2uiSchema {"$schema":"https://example.com/schema"}
   */
  value: string;
}

export function Broken(_props: BrokenProps): null {
  return null;
}

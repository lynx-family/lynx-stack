// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Demo text fixture.
 *
 * @a2uiCatalog
 */
export interface DemoTextProps {
  /** Literal text or data path binding. */
  text: string | { path: string };
  /** Text presentation variant. */
  variant?: 'body' | 'caption';
}

export function DemoText(_props: DemoTextProps): null {
  return null;
}

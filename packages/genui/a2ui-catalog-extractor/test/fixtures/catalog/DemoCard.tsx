// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Demo card fixture.
 *
 * @remarks Generated from a TSX fixture.
 * @a2uiCatalog DemoCard
 */
export interface DemoCardProps {
  /** Main title. */
  title: string | { path: string };
  /** Visual tone. */
  tone?: 'neutral' | 'accent';
  /** Number of columns. */
  columns?: 1 | 2 | 3;
  /**
   * Extra payload.
   *
   * @defaultValue `{}`
   */
  context?: Record<string, string | number | boolean>;
  /** Server-dispatched action payload. */
  action: {
    event: {
      /** Event name. */
      name: string;
    };
  };
}

export function DemoCard(_props: DemoCardProps): null {
  return null;
}

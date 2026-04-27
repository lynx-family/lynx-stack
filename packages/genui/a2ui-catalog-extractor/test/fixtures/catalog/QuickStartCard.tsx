// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Quick start card fixture.
 *
 * @remarks This fixture mirrors the README quick start.
 * @a2uiCatalog QuickStartCard
 */
export interface QuickStartCardProps {
  /** Card title text or data binding. */
  title: string | { path: string };
  /** Visual tone used by the renderer. */
  tone?: 'neutral' | 'accent';
  /**
   * Tags shown below the title.
   *
   * @defaultValue `[]`
   */
  tags?: string[];
  /** Author metadata rendered in the card footer. */
  author: {
    /** Display name. */
    name: string;
    /** Optional profile URL. */
    url?: string;
  };
  /**
   * Extra analytics context sent with user actions.
   *
   * @defaultValue `{}`
   */
  context?: Record<string, string | number | boolean>;
}

export function QuickStartCard(_props: QuickStartCardProps): null {
  return null;
}

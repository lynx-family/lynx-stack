// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactElement } from '@lynx-js/react';

import { useIsland } from './useIsland.js';
import type { UseIslandOptions } from './useIsland.js';
import type { IslandReference } from '../runtime/types.js';

/** Props for rendering an exposed island module in its own ReactLynx view.
 * @public
 */
export interface IslandProps<Data> {
  /** Unique view ID that can be used in a CSS ID selector. */
  id: string;
  /** Module to instantiate. Pass null to leave the container empty. */
  module: IslandReference | null;
  /** Complete serializable props snapshot passed to the island. */
  props: Data;
  /** CSS class for the host view. @defaultValue `''` */
  className?: string;
  /** Observe lifecycle changes and receive error messages on failure. */
  onStatusChange?: UseIslandOptions<Data>['onStatusChange'];
}

/**
 * Render an independent island instance in a ReactLynx view.
 *
 * Inline modules render in the host's first frame from the initial props.
 * Remote modules and modules supplied after the initial render load later.
 * Background initialization does not block inline rendering.
 * @public
 */
export function Island<Data>(
  { id, module, props, className = '', onStatusChange }: IslandProps<Data>,
): ReactElement {
  const ref = useIsland(module, {
    container: `#${id}`,
    props,
    onStatusChange,
  });
  return <view id={id} className={className} main-thread:ref={ref} />;
}

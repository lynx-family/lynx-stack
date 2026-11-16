// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactElement } from '@lynx-js/react';
import { useId } from '@lynx-js/react/hooks';

import { useIsland } from './useIsland.js';

/** Props for rendering an exposed island module in its own ReactLynx view.
 * @public
 */
export interface IslandProps<Data> {
  /** Island name registered in the build plugin's `exposes` map. */
  name: string;
  /** Complete serializable props snapshot passed to the island. */
  props: Data;
  /** CSS class for the host view. @defaultValue `''` */
  className?: string;
}

/**
 * Render an independent island instance in a ReactLynx view.
 *
 * Modules supplied with the initial props render in the host's first frame.
 * Modules supplied afterward render when their container and props are available.
 * Background initialization does not block rendering.
 * The component owns its container and disposes its renderer on unmount.
 *
 * @example
 * ```tsx
 * <Island name="card" props={{ title: 'Hello' }} className="card" />
 * ```
 * @public
 */
export function Island<Data>(
  { name, props, className = '' }: IslandProps<Data>,
): ReactElement {
  const id = `lynx-island-${useId()}`;
  const ref = useIsland({ expose: name }, {
    container: `#${id}`,
    props,
  });
  return <view id={id} className={className} main-thread:ref={ref} />;
}

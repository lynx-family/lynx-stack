// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ReactElement } from '@lynx-js/react';

import { useParcel } from './useParcel.js';
import type { UseParcelOptions } from './useParcel.js';
import type { ParcelSource } from '../core/types.js';

/** Props for rendering a compiled parcel in its own ReactLynx view. */
export interface ParcelViewProps<Data> {
  /** Unique view ID that can be used in a CSS ID selector. */
  id: string;
  /** Compiled parcel to mount. Pass null to leave the container empty. */
  source: ParcelSource | null;
  /** Complete serializable data snapshot passed to the parcel. */
  data: Data;
  /** CSS class for the host view. */
  className?: string;
  /** Observe lifecycle changes and receive error messages on failure. */
  onStatusChange?: UseParcelOptions<Data>['onStatusChange'];
}

/** Render a compiled parcel and manage its lifecycle in a ReactLynx view. */
export function ParcelView<Data>(
  { id, source, data, className = '', onStatusChange }: ParcelViewProps<Data>,
): ReactElement {
  const ref = useParcel(source, {
    container: `#${id}`,
    props: data,
    onStatusChange,
  });
  return <view id={id} className={className} main-thread:ref={ref} />;
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ChatImage } from './ChatImage.jsx';
import { Image as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';

/** Chat image using Image(alt, src?), displayed in a 3:2 frame. */
export const Image: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => (
    <ChatImage key={props.src} src={props.src ?? ''} alt={props.alt ?? ''} />
  ),
};

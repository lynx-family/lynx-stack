// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { ImageBlock as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { ChatImage } from '../Image/ChatImage.jsx';

/** Chat image block preserving the loaded image's aspect ratio. */
export const ImageBlock: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) =>
    props.src
      ? (
        <ChatImage
          key={props.src}
          src={props.src}
          alt={props.alt ?? ''}
          block
        />
      )
      : null,
};

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { TextContent as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { Markdown } from '../markdown.jsx';

/** ReactLynx renderer for the OpenUI Chat TextContent contract. */
export const TextContent: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => (
    <Markdown text={props.text ?? ''} size={props.size ?? 'default'} />
  ),
};

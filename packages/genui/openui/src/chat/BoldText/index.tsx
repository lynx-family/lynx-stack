// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { BoldText as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { ChatText } from '../Text/index.jsx';

/** ReactLynx renderer for the OpenUI Chat BoldText contract. */
export const BoldText: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props }) => <ChatText props={props} bold />,
};

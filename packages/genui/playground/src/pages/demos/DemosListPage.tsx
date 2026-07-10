// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UI_DEMOS_LIST_SOURCE } from './a2ui.js';
import { DemosList } from './DemosList.js';
import { OPENUI_DEMOS_LIST_SOURCE } from './openui.js';
import type { Protocol } from '../../utils/protocol.js';

export function DemosListPage(
  props: { protocol: Protocol; theme: 'light' | 'dark' },
) {
  if (props.protocol.name === 'openui') {
    return <DemosList {...props} source={OPENUI_DEMOS_LIST_SOURCE} />;
  }

  return <DemosList {...props} source={A2UI_DEMOS_LIST_SOURCE} />;
}

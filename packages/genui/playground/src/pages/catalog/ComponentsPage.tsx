// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { A2UI_COMPONENT_CATALOG_SOURCE } from './a2ui.js';
import { ComponentCatalog } from './ComponentCatalog.js';
import { OPENUI_COMPONENT_CATALOG_SOURCE } from './openui.js';
import type { Protocol } from '../../utils/protocol.js';

export function ComponentsPage(
  props: {
    protocol: Protocol;
    componentName?: string;
    theme: 'light' | 'dark';
    embedded?: boolean;
  },
) {
  if (props.protocol.name === 'openui') {
    return (
      <ComponentCatalog
        {...props}
        source={OPENUI_COMPONENT_CATALOG_SOURCE}
      />
    );
  }

  return (
    <ComponentCatalog
      {...props}
      source={A2UI_COMPONENT_CATALOG_SOURCE}
    />
  );
}

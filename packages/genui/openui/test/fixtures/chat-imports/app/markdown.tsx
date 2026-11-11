// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import {
  createOpenUiLibrary,
  OpenUiRenderer,
} from '@lynx-js/genui/openui/explicit';
import { Card } from '@lynx-js/genui/openui/chat/Card';
import { TextContent } from '@lynx-js/genui/openui/chat/TextContent';

const library = createOpenUiLibrary({
  root: 'Card',
  includeDefaultComponents: false,
  components: [Card, TextContent],
});

root.render(
  <OpenUiRenderer
    library={library}
    response={'root = Card([TextContent("**Hello**")])'}
  />,
);

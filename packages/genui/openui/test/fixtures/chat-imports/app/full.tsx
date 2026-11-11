// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import { OpenUiRenderer } from '@lynx-js/genui/openui/explicit';
import { createOpenUiChatLibrary } from '@lynx-js/genui/openui/chat';

root.render(
  <OpenUiRenderer
    library={createOpenUiChatLibrary()}
    response={'root = Card([TextContent("**Hello**")])'}
  />,
);

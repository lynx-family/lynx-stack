// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import {
  createOpenUiLibrary,
  OpenUiRenderer,
} from '@lynx-js/genui/openui/explicit';
import { Card } from '@lynx-js/genui/openui/chat/Card';
import { BoldText } from '@lynx-js/genui/openui/chat/BoldText';
import { Button } from '@lynx-js/genui/openui/chat/Button';

const library = createOpenUiLibrary({
  root: 'Card',
  includeDefaultComponents: false,
  components: [Card, BoldText, Button],
});

root.render(
  <OpenUiRenderer
    library={library}
    response={'root = Card([BoldText("text", "Hello"), Button("Continue")])'}
  />,
);

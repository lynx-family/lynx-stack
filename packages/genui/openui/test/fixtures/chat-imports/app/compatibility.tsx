// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import {
  createOpenUiLibrary,
  OpenUiRenderer,
} from '@lynx-js/genui/openui/explicit';
import { Card } from '@lynx-js/genui/openui/chat/Card';
import { Callout } from '@lynx-js/genui/openui/chat/Callout';
import { CardHeader } from '@lynx-js/genui/openui/chat/CardHeader';
import { Image } from '@lynx-js/genui/openui/chat/Image';
import { ImageBlock } from '@lynx-js/genui/openui/chat/ImageBlock';
import { InlineHeader } from '@lynx-js/genui/openui/chat/InlineHeader';
import { Separator } from '@lynx-js/genui/openui/chat/Separator';
import { TextArea } from '@lynx-js/genui/openui/chat/TextArea';

const library = createOpenUiLibrary({
  root: 'Card',
  includeDefaultComponents: false,
  components: [
    Card,
    Callout,
    CardHeader,
    Image,
    ImageBlock,
    InlineHeader,
    Separator,
    TextArea,
  ],
});

root.render(
  <OpenUiRenderer
    library={library}
    response={'root = Card([CardHeader(null, "Subtitle"), InlineHeader("**Heading**"), Callout("info", "Tip", "Read this"), Image("Photo", "/photo.jpg"), ImageBlock("/photo.jpg", "Photo"), Separator("horizontal", false), TextArea("notes")])'}
  />,
);

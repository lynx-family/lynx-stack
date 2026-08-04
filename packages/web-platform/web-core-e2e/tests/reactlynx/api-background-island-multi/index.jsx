// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Background, root } from '@lynx-js/react';

import { Real } from './Real.jsx';
import { Section } from './Section.jsx';
import { Skeleton } from './Skeleton.jsx';

// Three islands with no tree relationship to each other: two siblings under
// the page, and a third inside a component that is itself first-screen
// content. Each is folded where it sits.
root.render(
  <page>
    <Background fallback={<Skeleton label='a' color='#c9d5e3' />}>
      <Real label='a' color='#2f6fd0' />
    </Background>
    <Section />
    <Background fallback={<Skeleton label='b' color='#d5c9e3' />}>
      <Real label='b' color='#6f2fd0' />
    </Background>
  </page>,
);

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRenderContext } from '@lynx-js/react';

import { Page } from './Page.jsx';

// Registration is synchronous, so the runtime is bound to this page's lynx
// before the engine replays the events it queued while app-service.js loaded.
// Rendering may be deferred; registration may not.
createRenderContext({ lynx }).render(<Page name='Page A' />);

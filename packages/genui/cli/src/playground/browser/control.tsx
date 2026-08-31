// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRoot } from 'react-dom/client';

import { bootstrapLocalPlayground } from './api-client.js';
import { LocalPlaygroundApp } from './LocalPlaygroundApp.js';

document.title = 'Lynx GenUI Playground';

void bootstrapLocalPlayground().then(
  (client) => {
    const root = document.getElementById('root');
    if (!root) throw new Error('Local Playground root is missing');
    createRoot(root).render(<LocalPlaygroundApp client={client} />);
  },
  (caught) => {
    const root = document.getElementById('root');
    if (!root) return;
    root.className = 'localAgentFatal';
    root.textContent = caught instanceof Error
      ? caught.message
      : String(caught);
  },
);

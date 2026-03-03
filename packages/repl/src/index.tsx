// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '@lynx-js/web-core';
import '@lynx-js/web-core/index.css';
import '@lynx-js/web-elements/index.css';
import '@lynx-js/web-elements/all';

import './globals.css';

import { createRoot } from 'react-dom/client';

import { App } from './App.js';

createRoot(document.getElementById('app')!).render(<App />);

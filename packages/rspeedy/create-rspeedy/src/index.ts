#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createLynx } from '@lynx-js/create-lynx'

// Superseded by `@lynx-js/create-lynx`. Kept so that `npm create rspeedy` and
// the template names it documented keep working, pinned to the build tool it
// is named after.
void createLynx({ name: 'rspeedy', tool: 'rspeedy' })

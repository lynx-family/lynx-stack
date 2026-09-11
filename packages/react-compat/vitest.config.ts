// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineProject } from 'vitest/config';
import type { UserWorkspaceConfig } from 'vitest/config';

import { vitestTestingLibraryPlugin } from '@lynx-js/react/testing-library/plugins';

const config: UserWorkspaceConfig = defineProject({
  plugins: [
    vitestTestingLibraryPlugin(),
  ],
  test: {
    name: 'react-compat',
  },
});

export default config;

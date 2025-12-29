// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import stylelint from 'stylelint';

import {
  rule as noUnsupportedPropertiesRule,
  ruleName,
} from './rules/no-unsupported-properties.js';

const plugin: stylelint.Plugin = stylelint.createPlugin(
  ruleName,
  noUnsupportedPropertiesRule,
);

export default plugin;

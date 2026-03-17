/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { init_server_in_shadow_css } from './wasm.js';
// @ts-expect-error
import IN_SHADOW_CSS_MODERN from '../../css/in_shadow.css?inline';

init_server_in_shadow_css(IN_SHADOW_CSS_MODERN);

export * from './wasm.js';
export * from './elementAPIs/createElementAPI.js';
export * from './deploy.js';
export * from './decode.js';

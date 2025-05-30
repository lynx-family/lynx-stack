// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * This file provides a lazy loader for Vue in Lynx's main thread (Lepus).
 */

// Import Vue from the actual Vue package
import * as Vue from 'vue';

// Export Vue APIs for the main thread
export * from 'vue';

// Export the default Vue instance
export default Vue; 

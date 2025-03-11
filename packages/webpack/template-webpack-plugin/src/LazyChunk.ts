// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Identifier for lazyCompilation in Lynx.
 *
 * Used to mark chunks that should be loaded on demand during runtime.
 *
 * @public
 */
const LAZY_CHUNK = 'lynx:lazy-chunk';

/**
 * Identifier for React Refresh lazy chunk
 *
 * This constant identifies the special chunk related to React's hot module replacement.
 * Since this chunk doesn't contain any CSS assets, it should be excluded from
 * cssHotUpdateList to prevent unnecessary fetch requests for .hot-update.json files.
 *
 * @public
 */
const REACT_REFRESH = '_react_background_packages_react_refresh_dist_index_js';

export { LAZY_CHUNK, REACT_REFRESH };

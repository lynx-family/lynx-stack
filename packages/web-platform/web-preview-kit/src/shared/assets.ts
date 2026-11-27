// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The path segment, under the Service Worker scope, that build assets are
 * served at: `<scope>__lynx_preview__/<instanceId>/<asset>`.
 */
export const ASSET_PATH_SEGMENT = '__lynx_preview__';

/**
 * Where the card bundles of the latest successful build are copied, under the
 * public path. A failed build rewrites the card bundles, so cards load from
 * the copies.
 */
export const CARDS_DIRECTORY = '.cards/';

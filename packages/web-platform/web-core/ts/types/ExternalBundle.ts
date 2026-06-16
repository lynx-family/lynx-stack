// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The result of a `lynx.fetchBundle` call on the web platform.
 *
 * Mirrors the native `fetchBundle` response shape consumed by
 * `@lynx-js/externals-loading-webpack-plugin`. On web only the async usage is
 * supported, so `fetchBundle` returns a `Promise<ExternalBundleResponse>`.
 *
 * - `code`: `0` on success, `-1` on failure.
 * - `errorMsg`: the failure reason, empty string on success.
 */
export interface ExternalBundleResponse {
  url: string;
  code: number;
  errorMsg: string;
}

/**
 * The external-bundle runtime APIs exposed on the `lynx` object in both the
 * main-thread and background JS realms.
 */
export interface ExternalBundleLynxAPIs {
  /**
   * Fetch (and decode + cache) an external `.lynx.bundle` by url.
   *
   * Only the async usage is supported on web; the returned promise resolves to
   * an {@link ExternalBundleResponse}. The synchronous `.wait()` usage is not
   * supported on web.
   */
  fetchBundle(url: string, options?: unknown): Promise<ExternalBundleResponse>;

  /**
   * Synchronously evaluate the JS of the custom section `sectionPath` from the
   * bundle previously fetched under `bundleName` and return its module exports.
   */
  loadScript(
    sectionPath: string,
    options: { bundleName: string },
  ): unknown;
}

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module elements/XWebView
 *
 * `x-webview` provides a web container that allows loading web pages.
 *
 * Attributes:
 * - `src`: The URL of the web page to load.
 * - `html`: The HTML content to load (via srcdoc).
 *
 * Events:
 * - `bindload`: Fired when the page loads. Detail: `{ url }`.
 * - `binderror`: Fired when an error occurs. Detail: `{ errorMsg }`.
 * - `bindmessage`: Fired when a message is received from the page. Detail: `{ msg }`.
 *
 * Methods:
 * - `reload()`: Reloads the current page.
 */
export { XWebView } from './XWebView.js';

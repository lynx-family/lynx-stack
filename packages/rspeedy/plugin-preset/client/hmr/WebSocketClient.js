// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @license MIT
Copyright JS Foundation and other contributors

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export default class WebSocketClient {
  /**
   * @param {string} url - The WebSocket URL.
   */
  constructor(url) {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    this.client = new WebSocket(url)
    this.client.onerror = (error) => {
      // TODO: use the real webpack logger
      console.error('[webpack-dev-server]', error)
    }
  }

  /**
   * @param {(...args: any[]) => void} f - The callback for onOpen.
   */
  onOpen(f) {
    this.client.onopen = f
  }

  /**
   * @param {(...args: any[]) => void} f - The callback for onClose.
   */
  onClose(f) {
    this.client.onclose = f
  }

  // call f with the message string as the first argument
  /**
   * @param {(...args: any[]) => void} f - The callback for onMessage.
   */
  onMessage(f) {
    this.client.onmessage = (e) => {
      f(e.data)
    }
  }
}

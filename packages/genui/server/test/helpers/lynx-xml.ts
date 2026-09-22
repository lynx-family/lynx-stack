// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Give mocked model text the document envelope required by XML finalization. */
export function lynxXmlTestText(text: string): string {
  return `<!doctype lynx>\n<lynx engine-version="4.2"><script thread="main">const testOutput = ${
    JSON.stringify(text)
  };</script></lynx>`;
}

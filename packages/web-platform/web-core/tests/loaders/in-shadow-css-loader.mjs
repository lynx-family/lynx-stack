// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export default function inShadowCssLoader() {
  const marker = this.resourcePath.includes('bulk')
    ? '/* INJECTED_SHADOW_CSS_BULK */'
    : '/* INJECTED_SHADOW_CSS */';

  return `export default ${JSON.stringify(marker)};`;
}

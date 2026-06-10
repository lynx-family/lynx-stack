// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@mastra/core',
    '@lynx-js/ui-judge',
    '@midscene/core',
    '@midscene/shared',
    '@midscene/web',
    '@sparticuz/chromium',
    'playwright-core',
  ],
};

export default nextConfig;

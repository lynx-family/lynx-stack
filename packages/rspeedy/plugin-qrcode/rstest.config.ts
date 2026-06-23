// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core'

const config: ReturnType<typeof defineConfig> = defineConfig({
  name: 'rspeedy/qrcode',
  globals: true,
  include: ['**/test/*.spec.ts', '**/test/*.test.ts'],
  // These tests spin up a real dev server and wait for compiles/re-renders.
  // The default 5s budget is too tight on busy CI runners (the dev-compile
  // wait alone allows up to 5s), which made the QR re-render polls flake.
  testTimeout: 20_000,
})

export default config

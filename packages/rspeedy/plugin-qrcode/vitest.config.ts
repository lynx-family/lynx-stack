import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'rspeedy/qrcode',
    // These tests spin up a real dev server and wait for compiles/re-renders.
    // The default 5s budget is too tight on busy CI runners (the dev-compile
    // wait alone allows up to 5s), which made the QR re-render polls flake.
    testTimeout: 20_000,
  },
})

export default config

import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'

const config: UserWorkspaceConfig = defineProject({
  test: {
    name: 'rspeedy/lynx-bundle-rslib-config',
    setupFiles: ['@lynx-js/vitest-setup/setup.ts'],
  },
})

export default config

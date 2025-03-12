import { defineProject } from 'vitest/config'
import type { UserWorkspaceConfig } from 'vitest/config'

const config: UserWorkspaceConfig = defineProject({
  test: {
    env: {
      NO_COLOR: 'true',
    },
  },
})

export default config

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'rspeedy/create-lynx',
    include: ['test/**/*.test.ts'],
  },
})

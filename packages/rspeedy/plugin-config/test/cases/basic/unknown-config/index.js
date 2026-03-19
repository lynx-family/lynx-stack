/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'

it('should have unknown config in template', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { sourceContent } = JSON.parse(content)

  expect(sourceContent.config).not.toHaveProperty('unknown')
})

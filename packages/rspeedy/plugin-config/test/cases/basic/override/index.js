/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'

it('should override existing config', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { sourceContent } = JSON.parse(content)

  expect(sourceContent.config).toHaveProperty('enableA11y', false)
})

it('should override default config', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { sourceContent } = JSON.parse(content)

  expect(sourceContent.config).toHaveProperty(
    'enableNewIntersectionObserver',
    false,
  )
})

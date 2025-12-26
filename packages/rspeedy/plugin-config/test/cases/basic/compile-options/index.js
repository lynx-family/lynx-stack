/// <reference types="vitest/globals" />

import { readFile } from 'node:fs/promises'
import path from 'node:path'

it('should override existing config', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { compilerOptions, sourceContent } = JSON.parse(content)

  expect(compilerOptions).toHaveProperty('enableCSSSelector', false)
  expect(sourceContent.config).not.toHaveProperty('enableCSSSelector')
})

it('should override default config', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { compilerOptions, sourceContent } = JSON.parse(content)

  expect(compilerOptions).toHaveProperty('enableRemoveCSSScope', false)
  expect(sourceContent.config).not.toHaveProperty('enableRemoveCSSScope')
})

it('should not override non-provided config', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { compilerOptions, sourceContent } = JSON.parse(content)

  expect(compilerOptions).toHaveProperty('defaultDisplayLinear', true)
  expect(sourceContent.config).not.toHaveProperty('defaultDisplayLinear')
})

it('should read engineVersion', async () => {
  const content = await readFile(path.join(__dirname, 'tasm.json'), 'utf-8')
  const { compilerOptions, sourceContent } = JSON.parse(content)

  expect(compilerOptions).toHaveProperty('targetSdkVersion', '3.2')
  expect(compilerOptions).not.toHaveProperty('engineVersion')
  expect(sourceContent.config).not.toHaveProperty('targetSdkVersion')
  expect(sourceContent.config).not.toHaveProperty('engineVersion')
})

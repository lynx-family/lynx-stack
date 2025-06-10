// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { exec } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, test } from 'vitest'

describe('register - hooks', () => {
  const registerPath = pathToFileURL(
    path.resolve(__dirname, './fixtures/register.js'),
  ).toString()

  async function runWithRegister(script: string) {
    return await new Promise<[string, string]>((resolve, reject) => {
      exec(`node --import ${registerPath} ${script}`, {
        env: process.env,
      }, (err, stdout, stderr) => {
        if (err) {
          return reject(err)
        }
        return resolve([stdout, stderr])
      })
    })
  }

  describe('load', () => {
    test('load with query', async () => {
      const [stdout] = await runWithRegister(
        path.resolve(__dirname, './fixtures/register/with-query.ts'),
      )

      expect(stdout).toMatchInlineSnapshot(`
        "42
        42
        "
      `)
    })
  })

  describe('Error cases', () => {
    test('resolve non exist package', async () => {
      await expect(() =>
        runWithRegister(
          path.resolve(__dirname, './fixtures/invalid-config/resolve-error.ts'),
        )
      ).rejects.toThrowError(`Cannot find package 'non-exist-pkg'`)
    })

    test('resolve non exist module', async () => {
      await expect(() =>
        runWithRegister(
          path.resolve(
            __dirname,
            './fixtures/invalid-config/resolve-error-2.ts',
          ),
        )
      ).rejects.toThrowError(
        `Cannot find module '${
          path.resolve(
            __dirname,
            './fixtures/invalid-config/non-exist-module.js',
          )
        }'`,
      )
    })
  })
})

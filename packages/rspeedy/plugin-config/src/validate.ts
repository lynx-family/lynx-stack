// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import color from 'picocolors'
import { compilerOptionsKeys, configKeys } from '@lynx-js/type-config'

import type { Config } from './pluginLynxConfig.js'

interface ValidationError {
  expected: string
  path: string
  value: unknown
}

type ValidationResult<T> =
  | {
    success: true
    data: T
  }
  | {
    success: false
    errors: ValidationError[]
  }

const knownKeys = new Set<string>([
  ...compilerOptionsKeys,
  ...configKeys,
])

const numberKeys = new Set([
  'longPressDuration',
  'observerFrameRate',
  'pipelineSchedulerConfig',
  'redBoxImageSizeWarningThreshold',
])

const stringKeys = new Set([
  'cli',
  'customData',
  'preferredFps',
  'reactVersion',
  'tapSlop',
  'targetSdkVersion',
  'templateDebugUrl',
  'version',
])

export function validateConfig(input: unknown): ValidationResult<Config> {
  const errors: ValidationError[] = []

  if (!isRecord(input)) {
    errors.push({
      expected: 'object',
      path: '$input',
      value: input,
    })
    return { success: false, errors }
  }

  for (const [key, value] of Object.entries(input)) {
    const path = `$input.${key}`

    if (!knownKeys.has(key)) {
      errors.push({
        expected: 'undefined',
        path,
        value,
      })
      continue
    }

    validateProperty(errors, path, key, value)
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return { success: true, data: input as Config }
}

export function validate(input: unknown): Config {
  const result = validateConfig(input)

  if (result.success) {
    return result.data
  }

  const messages = result.errors
    .flatMap(({ expected, path, value }) => {
      if (expected === 'undefined') {
        // Unknown properties
        return [`  Unsupported configuration: \`${color.red(path)}\``, '']
      }

      return [
        `Invalid config on \`${color.red(path)}\`.`,
        `  - Expect to be ${color.green(expected)}`,
        `  - Got: ${color.red(whatIs(value))}`,
        '',
      ]
    })

  // We use `Array.isArray` outside to deal with error messages
  throw new Error(
    [
      '[pluginLynxConfig] Invalid configuration.',
      '',
    ]
      .concat(messages)
      .join('\n'),
  )
}

function whatIs(value: unknown): string {
  return Object.prototype.toString.call(value)
    .replace(/^\[object\s+([a-z]+)\]$/i, '$1')
    .toLowerCase()
}

function validateProperty(
  errors: ValidationError[],
  path: string,
  key: string,
  value: unknown,
): void {
  if (value === undefined) {
    return
  }

  if (key === 'customCSSInheritanceList') {
    if (!Array.isArray(value)) {
      errors.push({
        expected: '(Array<string> | undefined)',
        path,
        value,
      })
      return
    }

    value.forEach((item, index) => {
      if (typeof item !== 'string') {
        errors.push({
          expected: 'string',
          path: `${path}[${index}]`,
          value: item,
        })
      }
    })
    return
  }

  if (key === 'enableLynxScrollFluency') {
    if (typeof value !== 'boolean' && typeof value !== 'number') {
      errors.push({
        expected: '(boolean | number | undefined)',
        path,
        value,
      })
    }
    return
  }

  if (key === 'extraInfo') {
    if (!isRecord(value)) {
      errors.push({
        expected: '(Record<string, unknown> | undefined)',
        path,
        value,
      })
    }
    return
  }

  if (key === 'quirksMode') {
    if (typeof value !== 'boolean' && typeof value !== 'string') {
      errors.push({
        expected: '(boolean | string | undefined)',
        path,
        value,
      })
    }
    return
  }

  if (numberKeys.has(key)) {
    if (typeof value !== 'number') {
      errors.push({
        expected: '(number | undefined)',
        path,
        value,
      })
    }
    return
  }

  if (stringKeys.has(key)) {
    if (typeof value !== 'string') {
      errors.push({
        expected: '(string | undefined)',
        path,
        value,
      })
    }
    return
  }

  if (typeof value !== 'boolean') {
    errors.push({
      expected: '(boolean | undefined)',
      path,
      value,
    })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

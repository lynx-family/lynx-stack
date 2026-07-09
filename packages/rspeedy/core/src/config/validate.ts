// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import color from 'picocolors'
import * as typia from 'typia'

import type { Config } from './index.js'

type EnvironmentConfig = NonNullable<
  NonNullable<Config['environments']>[string]
>
type SourceConfig = NonNullable<Config['source']>
type ValidationError = typia.IValidation.IError

// Keep the public Config types intact while avoiding typia's TS7 native
// transform gaps around recursive Rsbuild/Rspack extension points.
interface ValidatableEnvironmentConfig
  extends Omit<EnvironmentConfig, 'plugins'>
{
  plugins?: unknown[] | undefined
}

interface ValidatableSourceConfig
  extends Omit<SourceConfig, 'assetsInclude' | 'exclude' | 'include'>
{
  assetsInclude?: unknown
  exclude?: unknown
  include?: unknown
}

interface ValidatableConfig {
  dev?: Config['dev']
  environments?: Record<string, ValidatableEnvironmentConfig>
  mode?: Config['mode']
  output?: Config['output']
  performance?: Config['performance']
  resolve?: Config['resolve']
  server?: Config['server']
  source?: ValidatableSourceConfig
  splitChunks?: Config['splitChunks']
  tools?: Config['tools']
  plugins?: unknown[] | undefined
}

const validateTypiaConfig: (
  input: unknown,
) => typia.IValidation<ValidatableConfig> = input =>
  typia.validateEquals<ValidatableConfig>(input)

export const validateConfig: (
  input: unknown,
) => typia.IValidation<Config> = input => {
  const result = validateTypiaConfig(input)
  const errors = [
    ...(result.success ? [] : result.errors),
    ...validateRuleSetConditions(input),
  ]

  if (errors.length === 0) {
    return result as typia.IValidation<Config>
  }

  return {
    success: false,
    data: input,
    errors,
  }
}

export function validate(input: unknown, configPath?: string): Config {
  const result = validateConfig(input)

  if (result.success) {
    return result.data
  }

  const messages = result.errors.flatMap(({ expected, path, value }) => {
    if (expected === 'undefined') {
      // Unknown properties
      return [`Unknown property: \`${color.red(path)}\` in configuration`, '']
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
      `Invalid configuration${
        configPath ? ` loaded from ${color.dim(configPath)}` : '.'
      }`,
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

const ruleSetConditionExpected =
  '(RegExp | RuleSetConditions | RuleSetLogicalConditions | string)'

function validateRuleSetConditions(input: unknown): ValidationError[] {
  if (!isRecord(input) || !isRecord(input['source'])) {
    return []
  }

  const source = input['source']
  return [
    ...validateOptionalRuleSetCondition(
      source['assetsInclude'],
      '$input.source.assetsInclude',
      '(RegExp | RuleSetConditions | RuleSetLogicalConditions | string | undefined)',
    ),
    ...validateOptionalRuleSetConditionArray(
      source['exclude'],
      '$input.source.exclude',
    ),
    ...validateOptionalRuleSetConditionArray(
      source['include'],
      '$input.source.include',
    ),
  ]
}

function validateOptionalRuleSetConditionArray(
  value: unknown,
  path: string,
): ValidationError[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [
      {
        path,
        expected: '(Array<RuleSetCondition> | undefined)',
        value,
      },
    ]
  }

  return value.flatMap((item, index) =>
    validateRuleSetCondition(item, `${path}[${index}]`)
  )
}

function validateOptionalRuleSetCondition(
  value: unknown,
  path: string,
  expected: string,
): ValidationError[] {
  if (value === undefined) {
    return []
  }

  const errors = validateRuleSetCondition(value, path)
  if (
    errors.length === 1
    && errors[0]!.path === path
    && errors[0]!.expected === ruleSetConditionExpected
  ) {
    return [{ path, expected, value }]
  }

  return errors
}

function validateRuleSetCondition(
  value: unknown,
  path: string,
): ValidationError[] {
  if (isRuleSetConditionLeaf(value)) {
    return []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      validateRuleSetCondition(item, `${path}[${index}]`)
    )
  }

  if (!isRecord(value)) {
    return [{ path, expected: ruleSetConditionExpected, value }]
  }

  const errors: ValidationError[] = []
  const keys = Object.keys(value)
  const knownKeys = new Set(['and', 'or', 'not'])

  for (const key of keys) {
    if (!knownKeys.has(key)) {
      errors.push({
        path: appendPropertyPath(path, key),
        expected: 'undefined',
        value: value[key],
      })
    }
  }

  errors.push(
    ...validateRuleSetConditionList(value['and'], `${path}.and`),
    ...validateRuleSetConditionList(value['or'], `${path}.or`),
  )

  if (value['not'] !== undefined) {
    errors.push(...validateRuleSetCondition(value['not'], `${path}.not`))
  }

  return errors
}

function validateRuleSetConditionList(
  value: unknown,
  path: string,
): ValidationError[] {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return [
      {
        path,
        expected: '(RuleSetConditions | undefined)',
        value,
      },
    ]
  }

  return value.flatMap((item, index) =>
    validateRuleSetCondition(item, `${path}[${index}]`)
  )
}

function isRuleSetConditionLeaf(value: unknown): boolean {
  return typeof value === 'string'
    || typeof value === 'function'
    || value instanceof RegExp
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && !(value instanceof RegExp)
}

function appendPropertyPath(path: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`
}

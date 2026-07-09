// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

const topLevelKeys = new Set([
  'compat',
  'customCSSInheritanceList',
  'debugInfoOutside',
  'defaultDisplayLinear',
  'defineDCE',
  'enableAccessibilityElement',
  'enableCSSInheritance',
  'enableCSSInvalidation',
  'enableCSSSelector',
  'enableNewGesture',
  'enableRemoveCSSScope',
  'enableSSR',
  'enableUiSourceMap',
  'engineVersion',
  'experimental_isLazyBundle',
  'experimental_useElementTemplate',
  'extractStr',
  'firstScreenSyncTiming',
  'globalPropsMode',
  'optimizeBundleSize',
  'removeDescendantSelectorScope',
  'shake',
  'targetSdkVersion',
])

const topLevelBooleanKeys = new Set([
  'debugInfoOutside',
  'defaultDisplayLinear',
  'enableAccessibilityElement',
  'enableCSSInheritance',
  'enableCSSInvalidation',
  'enableCSSSelector',
  'enableNewGesture',
  'enableRemoveCSSScope',
  'enableSSR',
  'enableUiSourceMap',
  'experimental_isLazyBundle',
  'experimental_useElementTemplate',
  'removeDescendantSelectorScope',
])

const topLevelStringKeys = new Set([
  'engineVersion',
  'targetSdkVersion',
])

const compatKeys = new Set([
  'addComponentElement',
  'additionalComponentAttributes',
  'componentsPkg',
  'darkMode',
  'disableCreateSelectorQueryIncompatibleWarning',
  'disableDeprecatedWarning',
  'newRuntimePkg',
  'oldRuntimePkg',
  'removeComponentAttrRegex',
  'simplifyCtorLikeReactLynx2',
  'target',
])

const compatBooleanKeys = new Set([
  'disableCreateSelectorQueryIncompatibleWarning',
  'disableDeprecatedWarning',
  'simplifyCtorLikeReactLynx2',
])

const compatStringArrayKeys = new Set([
  'additionalComponentAttributes',
  'componentsPkg',
  'oldRuntimePkg',
])

const shakeArrayKeys = new Set([
  'pkgName',
  'removeCall',
  'removeCallParams',
  'retainProp',
])

export function validateConfig(
  input: unknown,
): PluginReactLynxOptions | undefined {
  if (input === undefined) {
    return undefined
  }

  if (!isRecord(input)) {
    throw invalidConfig(
      '$input',
      '(PluginReactLynxOptions | undefined)',
      input,
    )
  }

  for (const [key, value] of Object.entries(input)) {
    const path = `$input.${key}`

    if (!topLevelKeys.has(key)) {
      throw unknownProperty(path)
    }

    validateTopLevelProperty(path, key, value)
  }

  return input as PluginReactLynxOptions
}

function validateTopLevelProperty(
  path: string,
  key: string,
  value: unknown,
): void {
  if (value === undefined) {
    return
  }

  if (topLevelBooleanKeys.has(key)) {
    validateBoolean(path, value)
    return
  }

  if (topLevelStringKeys.has(key)) {
    validateString(path, value)
    return
  }

  switch (key) {
    case 'compat':
      validateCompat(path, value)
      return
    case 'customCSSInheritanceList':
      validateStringArray(path, value)
      return
    case 'defineDCE':
      validateDefineDCE(path, value)
      return
    case 'extractStr':
      validateExtractStr(path, value)
      return
    case 'firstScreenSyncTiming':
      validateOneOf(path, value, ['immediately', 'jsReady', 'manual'])
      return
    case 'globalPropsMode':
      validateOneOf(path, value, ['reactive', 'event'])
      return
    case 'optimizeBundleSize':
      validateOptimizeBundleSize(path, value)
      return
    case 'shake':
      validateShake(path, value)
      return
  }
}

function validateCompat(path: string, value: unknown): void {
  if (!isRecord(value)) {
    throw invalidConfig(
      path,
      '(Partial<CompatVisitorConfig> | undefined)',
      value,
    )
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`

    if (!compatKeys.has(key)) {
      throw unknownProperty(nestedPath)
    }

    if (nestedValue === undefined) {
      continue
    }

    if (compatBooleanKeys.has(key)) {
      validateBoolean(nestedPath, nestedValue)
      continue
    }

    if (compatStringArrayKeys.has(key)) {
      validateStringArray(nestedPath, nestedValue)
      continue
    }

    switch (key) {
      case 'addComponentElement':
        validateBooleanOrObject(
          nestedPath,
          nestedValue,
          'AddComponentElementConfig',
          new Set(['compilerOnly']),
          new Set(['compilerOnly']),
        )
        break
      case 'darkMode':
        validateBooleanOrObject(
          nestedPath,
          nestedValue,
          'DarkModeConfig',
          new Set(['themeExpr']),
          new Set(),
          new Set(['themeExpr']),
        )
        break
      case 'newRuntimePkg':
      case 'removeComponentAttrRegex':
        validateString(nestedPath, nestedValue)
        break
      case 'target':
        validateOneOf(nestedPath, nestedValue, ['LEPUS', 'JS', 'MIXED'])
        break
    }
  }
}

function validateDefineDCE(path: string, value: unknown): void {
  if (!isRecord(value)) {
    throw invalidConfig(
      path,
      '(Partial<DefineDceVisitorConfig> | undefined)',
      value,
    )
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`

    if (key !== 'define') {
      throw unknownProperty(nestedPath)
    }

    if (nestedValue === undefined) {
      continue
    }

    if (!isRecord(nestedValue)) {
      throw invalidConfig(
        nestedPath,
        '(Record<string, string> | undefined)',
        nestedValue,
      )
    }

    for (const [defineKey, defineValue] of Object.entries(nestedValue)) {
      if (typeof defineValue !== 'string') {
        throw invalidConfig(`${nestedPath}.${defineKey}`, 'string', defineValue)
      }
    }
  }
}

function validateExtractStr(path: string, value: unknown): void {
  if (typeof value === 'boolean') {
    return
  }

  if (!isRecord(value)) {
    throw invalidConfig(
      path,
      '(Partial<ExtractStrConfig> | boolean | undefined)',
      value,
    )
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`

    if (key === 'strLength') {
      validateNumber(nestedPath, nestedValue)
    } else if (key === 'extractedStrArr') {
      validateStringArray(nestedPath, nestedValue)
    } else {
      throw unknownProperty(nestedPath)
    }
  }
}

function validateOptimizeBundleSize(path: string, value: unknown): void {
  if (typeof value === 'boolean') {
    return
  }

  if (!isRecord(value)) {
    throw invalidConfig(
      path,
      '(boolean | { mainThread?: boolean; background?: boolean } | undefined)',
      value,
    )
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`

    if (key !== 'mainThread' && key !== 'background') {
      throw unknownProperty(nestedPath)
    }

    validateBoolean(nestedPath, nestedValue)
  }
}

function validateShake(path: string, value: unknown): void {
  if (!isRecord(value)) {
    throw invalidConfig(
      path,
      '(Partial<ShakeVisitorConfig> | undefined)',
      value,
    )
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`

    if (!shakeArrayKeys.has(key)) {
      throw unknownProperty(nestedPath)
    }

    validateStringArray(nestedPath, nestedValue)
  }
}

function validateBoolean(path: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw invalidConfig(path, '(boolean | undefined)', value)
  }
}

function validateBooleanOrObject(
  path: string,
  value: unknown,
  typeName: string,
  objectKeys: Set<string>,
  booleanKeys: Set<string>,
  stringKeys: Set<string> = new Set(),
): void {
  if (typeof value === 'boolean') {
    return
  }

  if (!isRecord(value)) {
    throw invalidConfig(path, `(boolean | ${typeName} | undefined)`, value)
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`

    if (!objectKeys.has(key)) {
      throw unknownProperty(nestedPath)
    }

    if (booleanKeys.has(key)) {
      validateBoolean(nestedPath, nestedValue)
    } else if (stringKeys.has(key)) {
      validateString(nestedPath, nestedValue)
    }
  }
}

function validateNumber(path: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'number') {
    throw invalidConfig(path, '(number | undefined)', value)
  }
}

function validateString(path: string, value: unknown): void {
  if (value !== undefined && typeof value !== 'string') {
    throw invalidConfig(path, '(string | undefined)', value)
  }
}

function validateStringArray(path: string, value: unknown): void {
  if (value === undefined) {
    return
  }

  if (!Array.isArray(value)) {
    throw invalidConfig(path, '(Array<string> | undefined)', value)
  }

  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      throw invalidConfig(`${path}[${index}]`, 'string', item)
    }
  })
}

function validateOneOf(
  path: string,
  value: unknown,
  options: string[],
): void {
  if (typeof value !== 'string' || !options.includes(value)) {
    throw invalidConfig(
      path,
      `(${options.map(option => `"${option}"`).join(' | ')} | undefined)`,
      value,
    )
  }
}

function unknownProperty(path: string): Error {
  return new Error(
    `Unknown property: \`${path}\` in the configuration of pluginReactLynx. If you are trying to set a Lynx config, use \`pluginLynxConfig\` (the Lynx Config rsbuild plugin) instead.`,
  )
}

function invalidConfig(
  path: string,
  expected: string,
  value: unknown,
): Error {
  return new Error(
    [
      `Invalid config on pluginReactLynx: \`${path}\`.`,
      `  - Expect to be ${expected}`,
      `  - Got: ${whatIs(value)}`,
      '',
    ].join('\n'),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function whatIs(value: unknown): string {
  return Object.prototype.toString.call(value)
    .replace(/^\[object\s+([a-z]+)\]$/i, '$1')
    .toLowerCase()
}

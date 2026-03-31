// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const NPM_TEMPLATE_PREFIX = 'npm:'

/**
 * Sanitize package name and version to create a valid cache key
 */
export const sanitizeCacheKey = (packageName: string, version: string) => {
  const normalized = packageName.replace(/[\\/]/g, '_')
  const versionLabel = version || 'latest'
  return `${normalized}@${versionLabel}`
}

/**
 * Check if the input is an npm package template
 */
export function isNpmTemplate(templateInput: string): boolean {
  const trimmedInput = templateInput.trim()

  // Explicit npm: prefix
  if (trimmedInput.startsWith(NPM_TEMPLATE_PREFIX)) {
    return true
  }

  // Scoped package (@scope/package) or pure package name (no path separators)
  if (
    trimmedInput.startsWith('@')
    || (!trimmedInput.includes('/')
      && !trimmedInput.startsWith('http')
      && !trimmedInput.startsWith('.')
      && !trimmedInput.startsWith('github:'))
  ) {
    return true
  }

  return false
}

/**
 * Resolve npm template package and return the local path
 */
export function resolveNpmTemplate(
  packageName: string,
  version?: string,
  options?: { forceLatest?: boolean },
): string {
  const normalizedName = packageName.trim()

  // Handle version
  const versionSpecifier =
    version?.trim() && version.trim().toLowerCase() !== 'latest'
      ? version.trim()
      : 'latest'

  // Generate cache key
  const cacheKey = sanitizeCacheKey(normalizedName, versionSpecifier)
  const templateDir = path.join(process.cwd(), '.temp-templates', cacheKey)
  const installRoot = path.dirname(templateDir)
  const packagePath = path.join(installRoot, 'node_modules', normalizedName)

  // Check if we should reuse cache
  const forceLatest = options?.forceLatest ?? versionSpecifier === 'latest'
  const shouldReuseCache = !forceLatest && fs.existsSync(templateDir)

  if (shouldReuseCache) {
    return templateDir
  }

  // Create isolated package.json to prevent workspace conflicts
  const anchorPkgJson = path.join(installRoot, 'package.json')
  if (!fs.existsSync(anchorPkgJson)) {
    const minimal = { name: 'rspeedy-template-cache', private: true }
    fs.writeFileSync(
      anchorPkgJson,
      `${JSON.stringify(minimal, null, 2)}\n`,
      'utf8',
    )
  }

  // Install the package
  try {
    execSync(
      `npm install ${normalizedName}@${versionSpecifier} --no-save --package-lock=false --no-audit --no-fund --silent`,
      {
        cwd: installRoot,
        stdio: 'pipe',
      },
    )
  } catch {
    throw new Error(
      `Failed to install npm template "${normalizedName}@${versionSpecifier}". Please check if the package exists.`,
    )
  }

  // Find template directory (by priority)
  const possibleTemplatePaths = [
    path.join(packagePath, 'template'), // Priority: package/template
    path.join(packagePath, 'templates', 'app'),
    path.join(packagePath, 'templates', 'default'),
    packagePath, // Fallback: package root
  ]

  for (const pathCandidate of possibleTemplatePaths) {
    if (
      fs.existsSync(pathCandidate) && fs.statSync(pathCandidate).isDirectory()
    ) {
      // Copy to cache directory
      fs.mkdirSync(templateDir, { recursive: true })
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      fs.cpSync(pathCandidate, templateDir, { recursive: true })
      return templateDir
    }
  }

  throw new Error(
    `No valid template directory found in package "${normalizedName}". Expected one of: template/, templates/app/, templates/default/, or package root.`,
  )
}

/**
 * Resolve custom template (npm package, GitHub, or local path)
 */
export function resolveCustomTemplate(
  templateInput: string,
  version?: string,
): string {
  const trimmedInput = templateInput.trim()

  // Handle npm: prefix explicitly
  if (trimmedInput.startsWith(NPM_TEMPLATE_PREFIX)) {
    const packageName = trimmedInput.slice(NPM_TEMPLATE_PREFIX.length).trim()
    return resolveNpmTemplate(packageName, version)
  }

  // Handle scoped package or pure package name
  if (isNpmTemplate(trimmedInput)) {
    return resolveNpmTemplate(trimmedInput, version)
  }

  // For GitHub URLs or local paths, return as-is (handled by create-rstack)
  return trimmedInput
}

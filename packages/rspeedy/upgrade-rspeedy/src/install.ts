// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs'
import { EOL } from 'node:os'
import path from 'node:path'

import detectIndent from 'detect-indent'
import color from 'picocolors'
import { logger } from 'rslog'
import type { PackageJson } from 'type-fest'

import { devDependencies } from './version.js'

const LYNX_RSPEEDY = '@lynx-js/rspeedy'

export async function install(cwd: string): Promise<void> {
  const packageJSONPath = path.resolve(cwd, 'package.json')

  if (!fs.existsSync(packageJSONPath)) {
    const message = `${
      color.underline(color.yellow(packageJSONPath))
    } not found. Please run ${
      color.bold('upgrade-rspeedy')
    } in your Rspeedy project.`
    logger.error(message)

    throw new Error(message)
  }

  try {
    const content = await fs.promises.readFile(packageJSONPath, 'utf-8')
    const pkg = JSON.parse(content) as PackageJson

    if (
      pkg.dependencies?.[LYNX_RSPEEDY] === undefined
      && pkg.devDependencies?.[LYNX_RSPEEDY] === undefined
    ) {
      throw new Error(
        `No ${color.yellow(LYNX_RSPEEDY)} found in ${packageJSONPath}.

Please run ${color.bold('upgrade-rspeedy')} in your Rspeedy project.`,
      )
    }

    const { indent } = detectIndent(content)

    console.info()
    const dependenciesUpdated = updateDependencies(
      pkg,
      packageJSONPath,
      'dependencies',
    )
    console.info()
    const devDependenciesUpdated = updateDependencies(
      pkg,
      packageJSONPath,
      'devDependencies',
    )
    console.info()

    if (dependenciesUpdated || devDependenciesUpdated) {
      await fs.promises.writeFile(
        packageJSONPath,
        JSON.stringify(pkg, null, indent) + EOL,
        'utf-8',
      )
      logger.success(`${color.yellow(packageJSONPath)} has been updated.`)
      logger.success(
        `Please install the dependencies with your package manager.`,
      )
    }
  } catch (error) {
    logger.error(error)
    throw error
  }
}

function updateDependencies(
  pkg: PackageJson,
  packageJSONPath: string,
  name: 'dependencies' | 'devDependencies',
) {
  const dependencies = pkg[name]
  if (!dependencies) {
    logger.info(
      `No ${color.yellow(name)} is found in ${
        color.underline(packageJSONPath)
      }`,
    )
    return false
  }

  const updatedDependencies = findDependencies(dependencies)
    .filter(([, { original, target }]) => original !== target)

  if (updatedDependencies.length === 0) {
    logger.info(
      `No ${color.yellow(name)} need to be updated in ${
        color.underline(packageJSONPath)
      }`,
    )
    return false
  } else {
    const sep = '\n - '
    logger.info(
      `Updated ${color.yellow(name)}:\n${sep}${
        updatedDependencies.map(([name, { original, target }]) => {
          return `${color.cyan(name)}: ${color.dim(original)} -> ${
            color.green(target)
          }`
        }).join(sep)
      }`,
    )
  }

  updatedDependencies.forEach(([dependency, { target }]) => {
    dependencies[dependency] = target
  })

  return true
}

const targetDependencies = new Map(Object.entries(devDependencies ?? {}))

function findDependencies(
  dependencies: Record<string, string | undefined>,
) {
  return Object.entries(dependencies)
    .map(([name, original]) => {
      if (
        targetDependencies.has(name)
        // Avoid install packages like `commander` or `type-fest`
        && (name.startsWith('@lynx-js/') || name.includes('rsbuild'))
      ) {
        return [
          name,
          {
            original,
            target: targetDependencies.get(name)!,
          },
        ] as const
      }
      return null
    })
    .filter(i => i !== null)
}

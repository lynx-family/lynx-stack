// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
// See LICENSE in the project root for license information.

import * as fs from 'node:fs'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'

import { logger } from '@rsbuild/core'

import { debug } from '../debug.js'

enum Constants {
  rspeedyPackageName = '@lynx-js/rspeedy',
  unmanagedParameterLongName = '--unmanaged',
}

// Excerpted from PackageJsonLookup.tryGetPackageFolderFor()
function tryGetPackageFolderFor(
  resolvedFileOrFolderPath: string,
): string | undefined {
  // Is resolvedFileOrFolderPath itself a folder with a package.json file?  If so, return it.
  if (fs.existsSync(path.join(resolvedFileOrFolderPath, 'package.json'))) {
    return resolvedFileOrFolderPath
  }

  // Otherwise go up one level
  const parentFolder: string | undefined = path.dirname(
    resolvedFileOrFolderPath,
  )
  if (!parentFolder || parentFolder === resolvedFileOrFolderPath) {
    // We reached the root directory without finding a package.json file,
    // so cache the negative result
    return undefined // no match
  }

  // Recurse upwards
  return tryGetPackageFolderFor(parentFolder)
}

/**
 * When rspeedy is invoked via the shell path, we examine the project's package.json dependencies and try to load
 * the locally installed version of rspeedy. This avoids accidentally building using the wrong version of rspeedy.
 * Use "rspeedy --unmanaged" to bypass this feature.
 */
export function tryStartLocalRspeedy(
  root: string = process.cwd(),
): false | Promise<void> {
  if (process.argv.includes(Constants.unmanagedParameterLongName)) {
    logger.info(
      `Bypassing the Rspeedy version selector because ${
        JSON.stringify(Constants.unmanagedParameterLongName)
      } was specified.`,
    )
    logger.info()
    return false
  }

  // The unmanaged flag could be undiscoverable if it's not in their locally installed version
  debug(
    `Searching for a locally installed version of Rspeedy. Use the ${
      JSON.stringify(Constants.unmanagedParameterLongName)
    } flag if you want to avoid this.`,
  )

  // Find the package.json file that governs the current folder location
  const projectFolder: string | undefined = tryGetPackageFolderFor(
    root,
  )
  if (projectFolder) {
    debug(`found project at ${projectFolder}`)

    let rspeedyEntryPoint: string

    interface IPackageJSON {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }

    let packageJson: IPackageJSON
    try {
      const packageJsonPath = path.join(projectFolder, 'package.json')
      const packageJsonContent = fs.readFileSync(packageJsonPath).toString()

      try {
        packageJson = JSON.parse(packageJsonContent) as IPackageJSON
      } catch (error) {
        throw new Error(
          `Error parsing ${packageJsonPath}:${(error as Error).message}`,
        )
      }

      // Does package.json have a dependency on Rspeedy?
      if (
        !(packageJson.dependencies?.[Constants.rspeedyPackageName])
        && !(packageJson.devDependencies?.[Constants.rspeedyPackageName])
      ) {
        // No explicit dependency on rspeedy
        debug('The project does not have a dependency on Rspeedy')
        return false
      }

      // To avoid a loading the "resolve" NPM package, let's assume that the rspeedy dependency must be
      // installed as "<projectFolder>/node_modules/@lynx-js/rspeedy".
      const rspeedyFolder: string = path.join(
        projectFolder,
        'node_modules',
        ...Constants.rspeedyPackageName.split('/'),
      )

      rspeedyEntryPoint = path.join(rspeedyFolder, 'dist', 'cli', 'main.js')
      if (!fs.existsSync(rspeedyEntryPoint)) {
        debug(
          `Unable to find rspeedy entry point: ${rspeedyEntryPoint}, trying the legacy location.`,
        )

        // `lib/cli/main.js` is the legacy location where `tsc` outputs.
        rspeedyEntryPoint = path.join(rspeedyFolder, 'lib', 'cli', 'main.js')

        if (!fs.existsSync(rspeedyEntryPoint)) {
          debug(
            `Unable to find rspeedy entry point: ${rspeedyEntryPoint}, using the unmanaged version.`,
          )
          return false
        }
      }
    } catch (error) {
      throw new Error(
        `Error probing for local rspeedy version: ${(error as Error).message}`,
      )
    }

    debug(`found rspeedy entry point at ${rspeedyEntryPoint}`)

    // We found and successfully invoked the local rspeedy
    // Note that we are using `pathToFileURL` since absolute paths must be valid file:// URLs on Windows.
    return import(pathToFileURL(rspeedyEntryPoint).toString()).then((
      { main },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    ) => main(process.argv))
  }

  debug(`no project folder found from ${process.cwd()}`)

  // We couldn't find the package folder
  return false
}

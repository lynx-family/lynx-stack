// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Runs the regular API Extractor for this package (forwarding CLI args such
// as `--local`), then generates website/temp/type-config.api.json from the
// installed `@lynx-js/type-config` package so that api-documenter renders the
// full Lynx Config / CompilerOptions field reference alongside the
// `@lynx-js/config-rsbuild-plugin` API docs: the plugin's `Config` interface
// extends types from that package, and api-documenter can only resolve those
// references when the package is part of the same doc model.
//
// The package is copied out of node_modules before extraction: API Extractor
// treats files under a node_modules directory as external and refuses to
// follow their internal `export *` chains, which would silently drop the
// Config and CompilerOptions interfaces from the doc model.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'

const require = createRequire(import.meta.url)

const forwardedArgs = process.argv.slice(2).filter(arg => arg !== '--')
const apiExtractorBin = path.join(
  path.dirname(require.resolve('@microsoft/api-extractor/package.json')),
  'bin/api-extractor',
)

execFileSync(
  process.execPath,
  [apiExtractorBin, 'run', '--verbose', ...forwardedArgs],
  { stdio: 'inherit' },
)

const typeConfigPkgJsonPath = require.resolve(
  '@lynx-js/type-config/package.json',
)
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(scriptDir, '../../../..')
const tempFolder = path.join(repoRoot, 'website/temp')
const projectFolder = path.join(tempFolder, '.type-config-package')

function copyDirSync(source, destination) {
  fs.mkdirSync(destination, { recursive: true })
  for (const entry of fs.readdirSync(source)) {
    const sourcePath = path.join(source, entry)
    const destinationPath = path.join(destination, entry)
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirSync(sourcePath, destinationPath)
    } else {
      fs.copyFileSync(sourcePath, destinationPath)
    }
  }
}

fs.rmSync(projectFolder, { recursive: true, force: true })
copyDirSync(path.dirname(typeConfigPkgJsonPath), projectFolder)

const extractorConfig = ExtractorConfig.prepare({
  configObject: {
    projectFolder,
    mainEntryPointFilePath: path.join(projectFolder, 'index.d.ts'),
    compiler: {
      overrideTsconfig: {
        compilerOptions: { types: [], lib: ['es2022'] },
      },
    },
    apiReport: { enabled: false },
    docModel: {
      enabled: true,
      apiJsonFilePath: path.join(tempFolder, 'type-config.api.json'),
    },
    dtsRollup: { enabled: false },
    tsdocMetadata: { enabled: false },
    messages: {
      tsdocMessageReporting: { default: { logLevel: 'none' } },
    },
  },
  configObjectFullPath: undefined,
  packageJsonFullPath: path.join(projectFolder, 'package.json'),
})

const result = Extractor.invoke(extractorConfig, { localBuild: true })

fs.rmSync(projectFolder, { recursive: true, force: true })

if (!result.succeeded) {
  throw new Error(
    `API Extractor failed with ${result.errorCount} errors for @lynx-js/type-config`,
  )
}

console.info('Generated website/temp/type-config.api.json')

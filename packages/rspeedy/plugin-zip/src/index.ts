// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Package production output as a ZIP accepted by Lynx UI Judge.
 * @packageDocumentation
 */

import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'

import { createArchive, readOutput, validatePath } from './archive.js'

/** Options for {@link pluginZip}.
 * @public
 */
export interface PluginZipOptions {
  /**
   * ZIP filename inside the output directory. Directory components are not allowed.
   * @defaultValue 'dist.zip'
   */
  filename?: string | undefined
}

/**
 * Replace production build outputs with a ZIP and serve it through preview.
 * Development builds and dev servers keep their original outputs and URLs.
 *
 * @example
 * ```ts
 * import { pluginZip } from '@lynx-js/zip-rsbuild-plugin'
 * export default { plugins: [pluginZip()] }
 * ```
 * @public
 */
export function pluginZip(options: PluginZipOptions = {}): RsbuildPlugin {
  const filename = options.filename ?? 'dist.zip'
  validatePath(filename)
  if (filename.includes('/') || !filename.endsWith('.zip')) {
    throw new Error(
      'pluginZip filename must be a .zip filename without directories',
    )
  }

  return {
    name: 'lynx:rsbuild:zip',
    setup(api) {
      const isProductionBuild = (): boolean =>
        api.context.action === 'build'
        && (api.getRsbuildConfig().mode ?? process.env['NODE_ENV'])
          === 'production'
      const outputDirectory = (): string => {
        const distPath = api.getRsbuildConfig().output?.distPath
        return path.resolve(
          api.context.rootPath,
          typeof distPath === 'string' ? distPath : distPath?.root ?? 'dist',
        )
      }
      const assetPrefix = (directory: string): string => {
        const root = outputDirectory()
        const rootRelative = path.relative(root, api.context.rootPath)
        if (
          !rootRelative
          || !rootRelative.startsWith(`..${path.sep}`) && rootRelative !== '..'
        ) {
          throw new Error(
            'pluginZip output directory must not contain the project root',
          )
        }
        const relative = path.relative(root, directory)
        if (
          relative === '..' || relative.startsWith(`..${path.sep}`)
          || path.isAbsolute(relative)
        ) {
          throw new Error(
            'pluginZip requires environment output directories inside output.distPath.root',
          )
        }
        return `zip:///${
          relative
            ? `${
              relative.split(path.sep).map(part => encodeURIComponent(part))
                .join('/')
            }/`
            : ''
        }`
      }

      let previewArchive = false

      api.modifyEnvironmentConfig({
        order: 'post',
        handler(config) {
          if (isProductionBuild()) {
            config.output.assetPrefix = assetPrefix(path.resolve(
              api.context.rootPath,
              config.output.distPath?.root ?? 'dist',
            ))
          }
        },
      })
      api.modifyRspackConfig({
        order: 'post',
        handler(config, { environment }) {
          if (isProductionBuild()) {
            config.output ??= {}
            config.output.publicPath = assetPrefix(environment.distPath)
          }
        },
      })

      // Preserve files for watch rebuilds: Rsbuild copies public only once and
      // Rspack can skip emitting unchanged assets on later compilations.
      let previousFiles: Map<string, Uint8Array> | undefined
      api.onBeforeBuild({
        order: 'pre',
        async handler({ isFirstCompile }) {
          if (!isProductionBuild() || isFirstCompile || !previousFiles) return
          for (const [name, contents] of previousFiles) {
            const destination = path.join(api.context.distPath, name)
            await mkdir(path.dirname(destination), { recursive: true })
            await writeFile(destination, contents)
          }
        },
      })
      api.onCloseBuild(() => {
        previousFiles = undefined
      })

      api.onAfterBuild({
        order: 'post',
        async handler({ stats }) {
          if (!isProductionBuild() || stats?.hasErrors()) return
          const directory = api.context.distPath
          const directoryStat = await lstat(directory)
          if (!directoryStat.isDirectory()) {
            throw new Error('pluginZip output must be a regular directory')
          }
          const children = stats && ('stats' in stats ? stats.stats : [stats])
          if (children?.some(child => child.compilation.getAsset(filename))) {
            throw new Error(
              `ZIP filename conflicts with a build asset: ${filename}`,
            )
          }
          const files = await readOutput(directory, filename)
          const archive = createArchive(files)
          const temporary = path.join(
            directory,
            `.${filename}.${randomUUID()}.tmp`,
          )
          try {
            await writeFile(temporary, archive, { flag: 'wx' })
            await rename(temporary, path.join(directory, filename))
          } finally {
            await rm(temporary, { force: true })
          }
          previousFiles = files
          for (const name of await readdir(directory)) {
            if (name !== filename) {
              await rm(path.join(directory, name), {
                recursive: true,
                force: true,
              })
            }
          }
          api.logger.info(
            `ZIP archive: ${
              path.relative(
                api.context.rootPath,
                path.join(directory, filename),
              )
            } (${files.size} files)`,
          )
        },
      })

      api.modifyRsbuildConfig({
        order: 'post',
        handler(config) {
          config.server ??= {}
          const printUrls = config.server.printUrls
          if (printUrls === false) return
          config.server.printUrls = (params) => {
            if (!previewArchive || api.context.action !== 'preview') {
              return typeof printUrls === 'function'
                ? printUrls(params)
                : params.urls
            }
            // Lynx has no HTML routes. Remove any web routes so Rsbuild does
            // not append an HTML pathname to the archive download URL.
            params.routes.splice(0)
            const base = api.getNormalizedConfig().server.base
            return params.urls.map(url => ({
              label: 'Zip',
              url: new URL(
                `${base.replace(/\/$/, '')}/${encodeURIComponent(filename)}`,
                url,
              ).toString(),
            }))
          }
        },
      })

      api.onBeforeStartPreviewServer(async ({ server }) => {
        const archivePath = path.join(api.context.distPath, filename)
        const stat = await lstat(archivePath).catch(
          (error: NodeJS.ErrnoException) => {
            if (error.code === 'ENOENT') return undefined
            throw error
          },
        )
        if (!stat) return
        if (!stat.isFile()) {
          throw new Error(`ZIP output is not a regular file: ${archivePath}`)
        }
        previewArchive = true
        const base = api.getNormalizedConfig().server.base.replace(/\/$/, '')
        server.middlewares.use((req, res, next) => {
          const pathname = req.url?.split('?')[0]
          if (pathname !== `${base}/${encodeURIComponent(filename)}`) {
            return next()
          }
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          res.setHeader('Content-Type', 'application/zip')
          res.setHeader('Content-Length', stat.size)
          if (req.method === 'HEAD') return res.end()
          const stream = createReadStream(archivePath)
          stream.on('error', next)
          res.on('close', () => stream.destroy())
          stream.pipe(res)
        })
      })
    },
  }
}

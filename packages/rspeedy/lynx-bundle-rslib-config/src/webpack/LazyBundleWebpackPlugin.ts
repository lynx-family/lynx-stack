// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Asset, Compilation, Compiler } from 'webpack'

interface LazyBundleWebpackPluginOptions {
  templateFileName: string
  encode: (opts: unknown) => Promise<{ buffer: Buffer }>
}

const isDebug = (): boolean => {
  if (!process.env['DEBUG']) {
    return false
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',')
  return ['rsbuild', 'rspeedy', '*'].some((key) => values.includes(key))
}

export class LazyBundleWebpackPlugin {
  constructor(private options: LazyBundleWebpackPluginOptions) {}

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(
      LazyBundleWebpackPlugin.name,
      (compilation) => {
        compilation.hooks.processAssets.tapPromise(
          {
            name: LazyBundleWebpackPlugin.name,
            stage:
              /**
               * Generate the html after minification and dev tooling is done
               * and source-map is generated
               */
              compiler.webpack.Compilation
                .PROCESS_ASSETS_STAGE_OPTIMIZE_HASH,
          },
          () => {
            return this.#generateLazyBundle(
              compiler,
              compilation,
            )
          },
        )
      },
    )
  }

  async #generateLazyBundle(
    compiler: Compiler,
    compilation: Compilation,
  ): Promise<void> {
    const assets = compilation.getAssets()
    const { buffer, encodeOptions } = await this.#encode(assets)

    const { RawSource } = compiler.webpack.sources
    compilation.emitAsset(
      this.options.templateFileName,
      new RawSource(buffer, false),
    )
    if (isDebug()) {
      compilation.emitAsset(
        'tasm.json',
        new RawSource(
          JSON.stringify(encodeOptions, null, 2),
        ),
      )
    } else {
      assets.forEach(({ name }) => {
        compilation.deleteAsset(name)
      })
    }
  }

  async #encode(assets: Readonly<Asset>[]) {
    const customSections = assets
      .filter(({ name }) => name.endsWith('.js'))
      .reduce<Record<string, { content: string }>>((prev, cur) => ({
        ...prev,
        [cur.name.replace('.js', '')]: {
          content: cur.source.source().toString(),
        },
      }), {})

    const compilerOptions: Record<string, unknown> = {
      enableFiberArch: true,
      useLepusNG: true,
      enableReuseContext: true,
      bundleModuleMode: 'ReturnByFunction',
      targetSdkVersion: '2.11',
    }

    const encodeOptions = {
      compilerOptions,
      sourceContent: {
        appType: 'DynamicComponent',
      },
      customSections,
    }

    const { buffer } = await this.options.encode(encodeOptions)

    return { buffer, encodeOptions }
  }
}

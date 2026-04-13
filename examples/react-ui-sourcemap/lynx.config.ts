import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import type { RsbuildPlugin, Rspack } from '@lynx-js/rspeedy';
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

const DEBUG_METADATA_ASSET = 'debug-metadata.json';
const MOCK_UPLOAD_BASE_URL = 'https://mock-debug-metadata-upload.lynx.dev/';
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

interface GitMetadata {
  branch: string;
  commit: string;
  commitUrl: string | null;
  remoteUrl: string | null;
}

function runGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

function normalizeRepositoryUrl(remoteUrl: string | null): string | null {
  if (!remoteUrl) {
    return null;
  }

  if (remoteUrl.startsWith('git@github.com:')) {
    return `https://github.com/${
      remoteUrl.slice('git@github.com:'.length).replace(/\.git$/, '')
    }`;
  }

  if (remoteUrl.startsWith('https://github.com/')) {
    return remoteUrl.replace(/\.git$/, '');
  }

  return remoteUrl;
}

function getGitMetadata(): GitMetadata {
  const commit = runGit(['rev-parse', 'HEAD']) ?? 'unknown';
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']) ?? 'unknown';
  const remoteUrl = normalizeRepositoryUrl(
    runGit(['config', '--get', 'remote.origin.url']),
  );

  return {
    branch,
    commit,
    remoteUrl,
    commitUrl: remoteUrl ? `${remoteUrl}/commit/${commit}` : null,
  };
}

function mockUploadDebugMetadata(
  filenameTemplate: string,
  intermediate: string,
): string {
  const normalizedTemplate = filenameTemplate.replaceAll(
    path.win32.sep,
    path.posix.sep,
  );
  const normalizedIntermediate = intermediate.replaceAll(
    path.win32.sep,
    path.posix.sep,
  );
  const assetPath = path.posix.join(
    normalizedIntermediate.replace(/^\.\//, ''),
    DEBUG_METADATA_ASSET,
  );

  return new URL(
    `${assetPath}?template=${encodeURIComponent(normalizedTemplate)}`,
    MOCK_UPLOAD_BASE_URL,
  ).toString();
}

function pluginMockDebugMetadataUpload(): RsbuildPlugin {
  return {
    name: 'example:mock-debug-metadata-upload',
    setup(api) {
      const git = getGitMetadata();

      api.modifyBundlerChain(chain => {
        const exposed = api.useExposed<
          { LynxTemplatePlugin: typeof LynxTemplatePlugin }
        >(Symbol.for('LynxTemplatePlugin'));

        if (!exposed) {
          throw new Error(
            '[example:mock-debug-metadata-upload] Missing exposed LynxTemplatePlugin',
          );
        }

        chain.plugin('example:mock-debug-metadata-upload').use({
          apply(compiler) {
            compiler.hooks.thisCompilation.tap(
              'example:mock-debug-metadata-upload',
              compilation => {
                const hooks = exposed.LynxTemplatePlugin
                  .getLynxTemplatePluginHooks(
                    compilation as unknown as Parameters<
                      typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                    >[0],
                  );

                hooks.beforeEncode.tapPromise(
                  {
                    name: 'example:mock-debug-metadata-upload',
                    stage: 1000,
                  },
                  async args => {
                    const assetName = path.posix.format({
                      dir: args.intermediate,
                      base: DEBUG_METADATA_ASSET,
                    });
                    const debugMetadataAsset = compilation.getAsset(assetName);

                    if (debugMetadataAsset) {
                      const currentContent = debugMetadataAsset.source
                        .source()
                        .toString();
                      const debugMetadata = JSON.parse(
                        currentContent,
                      ) as Record<
                        string,
                        unknown
                      >;
                      const currentMeta =
                        typeof debugMetadata['meta'] === 'object'
                          && debugMetadata['meta'] !== null
                          ? debugMetadata['meta'] as Record<string, unknown>
                          : {};

                      compilation.updateAsset(
                        assetName,
                        new compiler.webpack.sources.RawSource(
                          JSON.stringify(
                            {
                              ...debugMetadata,
                              meta: {
                                ...currentMeta,
                                git,
                              },
                            },
                            null,
                            2,
                          ),
                        ),
                      );
                    }

                    const debugMetadataUrl = await Promise.resolve(
                      mockUploadDebugMetadata(
                        args.filenameTemplate,
                        args.intermediate,
                      ),
                    );

                    args.encodeData.sourceContent.config = {
                      ...args.encodeData.sourceContent.config,
                      debugMetadataUrl,
                    };

                    return args;
                  },
                );
              },
            );
          },
        } as Rspack.RspackPluginInstance);
      });
    },
  };
}

export default defineConfig({
  source: {
    entry: {
      main: path.join(projectRoot, 'src/index.tsx'),
    },
  },
  output: {
    distPath: {
      root: path.join(projectRoot, 'dist'),
    },
  },
  plugins: [
    pluginReactLynx({
      enableUiSourceMap: true,
    }),
    pluginMockDebugMetadataUpload(),
    pluginQRCode({
      schema(url) {
        return `${url}?fullscreen=true`;
      },
    }),
  ],
  environments: {
    web: {},
    lynx: {},
  },
});

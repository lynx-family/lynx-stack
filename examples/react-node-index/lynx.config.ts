import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import type { RsbuildPlugin, Rspack } from '@lynx-js/rspeedy';
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

const UI_SOURCE_MAP_ASSET = 'ui-source-map.json';
const MOCK_UPLOAD_BASE_URL = 'https://mock-ui-source-map-upload.lynx.dev/';
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

function mockUploadUiSourceMap(
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
    UI_SOURCE_MAP_ASSET,
  );

  return new URL(
    `${assetPath}?template=${encodeURIComponent(normalizedTemplate)}`,
    MOCK_UPLOAD_BASE_URL,
  ).toString();
}

function pluginMockUiSourceMapUpload(): RsbuildPlugin {
  return {
    name: 'example:mock-ui-source-map-upload',
    setup(api) {
      const git = getGitMetadata();

      api.modifyBundlerChain(chain => {
        const exposed = api.useExposed<
          { LynxTemplatePlugin: typeof LynxTemplatePlugin }
        >(Symbol.for('LynxTemplatePlugin'));

        if (!exposed) {
          throw new Error(
            '[example:mock-ui-source-map-upload] Missing exposed LynxTemplatePlugin',
          );
        }

        chain.plugin('example:mock-ui-source-map-upload').use({
          apply(compiler) {
            compiler.hooks.thisCompilation.tap(
              'example:mock-ui-source-map-upload',
              compilation => {
                const hooks = exposed.LynxTemplatePlugin
                  .getLynxTemplatePluginHooks(
                    compilation as unknown as Parameters<
                      typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
                    >[0],
                  );

                hooks.beforeEncode.tapPromise(
                  {
                    name: 'example:mock-ui-source-map-upload',
                    stage: 1000,
                  },
                  async args => {
                    const assetName = path.posix.format({
                      dir: args.intermediate,
                      base: UI_SOURCE_MAP_ASSET,
                    });
                    const uiSourceMapAsset = compilation.getAsset(assetName);

                    if (uiSourceMapAsset) {
                      const currentContent = uiSourceMapAsset.source
                        .source()
                        .toString();
                      const uiSourceMap = JSON.parse(currentContent) as Record<
                        string,
                        unknown
                      >;

                      compilation.updateAsset(
                        assetName,
                        new compiler.webpack.sources.RawSource(
                          JSON.stringify(
                            {
                              ...uiSourceMap,
                              meta: {
                                ...(
                                  typeof uiSourceMap['meta'] === 'object'
                                    && uiSourceMap['meta'] !== null
                                    ? uiSourceMap['meta'] as Record<
                                      string,
                                      unknown
                                    >
                                    : {}
                                ),
                                git,
                              },
                            },
                            null,
                            2,
                          ),
                        ),
                      );
                    }

                    const uiSourceMapUrl = await Promise.resolve(
                      mockUploadUiSourceMap(
                        args.filenameTemplate,
                        args.intermediate,
                      ),
                    );

                    args.encodeData.sourceContent.config = {
                      ...args.encodeData.sourceContent.config,
                      uiSourceMapUrl,
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
    pluginMockUiSourceMapUpload(),
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

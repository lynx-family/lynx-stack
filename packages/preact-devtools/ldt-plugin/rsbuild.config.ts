import { defineConfig } from '@rsbuild/core';
import { type RspackPluginInstance } from '@rspack/core';
import { pluginPreact } from '@rsbuild/plugin-preact';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const isDev = process.env.NODE_ENV === 'development';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  html: {
    template: path.join(__dirname, './src/index.html'),
  },
  source: {
    entry: {
      index: {
        import: path.join(__dirname, './src/plugin-entry.ts'),
        // On dev mode we need to enable html to utilize the devServer to serve the index.js file
        html: isDev,
      },
    },
    define: {
      __DEBUG__: isDev ? JSON.stringify(true) : JSON.stringify(false),
    },
  },
  server: {
    port: 8080,
  },
  output: {
    minify: false,
    // Make sure we can serve the js at http://localhost:8080/dist/index.js on dev mode
    distPath: isDev
      ? {
        root: '.',
        js: './dist',
      }
      : {
        js: '.',
      },
    filenameHash: false,
  },
  performance: {
    chunkSplit: {
      strategy: 'all-in-one',
    },
  },
  plugins: [pluginPreact()],
  tools: {
    rspack: {
      output: {
        iife: false,
        library: {
          type: 'module',
        },
      },
      plugins: [
        {
          name: 'inject-to-js',
          apply(compiler) {
            compiler.hooks.compilation.tap('inject-to-js', (compilation) => {
              compilation.hooks.processAssets.tap('inject-to-js', (assets) => {
                let cssContent = '';
                for (const [name, asset] of Object.entries(assets)) {
                  if (name.endsWith('.css')) {
                    cssContent += asset.source().toString();
                    compilation.deleteAsset(name);
                  }
                }

                // svg for icons
                const svgContent = fs.readFileSync(
                  path.join(__dirname, '../src/view/sprite.svg'),
                  'utf-8',
                );

                const { ConcatSource } = compiler.webpack.sources;
                for (const [name] of Object.entries(assets)) {
                  if (name.endsWith('.js')) {
                    compilation.updateAsset(name, (old) => {
                      return new ConcatSource(
                        `
document.head.appendChild(document.createElement('style')).textContent = \`${cssContent}\`;
document.body.appendChild(document.createElement('svg')).outerHTML = \`${svgContent}\`;
`,
                        old,
                      );
                    });
                  }
                }
              });
            });
          },
        } as RspackPluginInstance,
      ],
    },
  },
});

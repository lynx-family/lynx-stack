import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { pluginExternalBundle } from '@lynx-js/external-bundle-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';
import type { RsbuildPlugin } from '@lynx-js/rspeedy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    if (iface) {
      for (const alias of iface) {
        if (
          alias.family === 'IPv4' && alias.address !== '127.0.0.1'
          && !alias.internal
        ) {
          return alias.address;
        }
      }
    }
  }
  return 'localhost';
}

const enableBundleAnalysis = !!process.env['RSPEEDY_BUNDLE_ANALYSIS'];
const PORT = 8291;
const EXTERNAL_BUNDLE_PREFIX = process.env['EXTERNAL_BUNDLE_PREFIX']
  ?? `http://${getIPAddress()}:${PORT}`;

const pluginServeExternals = (): RsbuildPlugin => ({
  name: 'serve-externals',
  setup(api) {
    api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
      return mergeRsbuildConfig(config, {
        dev: {
          setupMiddlewares: [
            (middlewares) => {
              middlewares.unshift((
                req: import('node:http').IncomingMessage,
                res: import('node:http').ServerResponse,
                next: () => void,
              ) => {
                if (req.url === '/react.lynx.bundle') {
                  const bundlePath = path.resolve(
                    __dirname,
                    '../../packages/react-umd/dist/react-dev.lynx.bundle',
                  );
                  if (fs.existsSync(bundlePath)) {
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    fs.createReadStream(bundlePath).pipe(res);
                    return;
                  }
                }
                if (req.url === '/comp-lib.lynx.bundle') {
                  const bundlePath = path.resolve(
                    __dirname,
                    './dist/comp-lib.lynx.bundle',
                  );
                  if (fs.existsSync(bundlePath)) {
                    res.setHeader('Content-Type', 'application/octet-stream');
                    res.setHeader('Access-Control-Allow-Origin', '*');
                    fs.createReadStream(bundlePath).pipe(res);
                    return;
                  }
                }
                next();
              });
              return middlewares;
            },
          ],
        },
      });
    });
  },
});

export default defineConfig({
  plugins: [
    pluginServeExternals(),
    pluginReactLynx(),
    pluginQRCode({
      schema(url) {
        // We use `?fullscreen=true` to open the page in LynxExplorer in full screen mode
        return `${url}?fullscreen=true`;
      },
    }),
    pluginExternalBundle({
      externals: {
        '@lynx-js/react': {
          libraryName: ['ReactLynx', 'React'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/internal': {
          libraryName: ['ReactLynx', 'ReactInternal'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/jsx-dev-runtime': {
          libraryName: ['ReactLynx', 'ReactJSXDevRuntime'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/jsx-runtime': {
          libraryName: ['ReactLynx', 'ReactJSXRuntime'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/lepus/jsx-dev-runtime': {
          libraryName: ['ReactLynx', 'ReactJSXLepusDevRuntime'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/lepus/jsx-runtime': {
          libraryName: ['ReactLynx', 'ReactJSXLepusRuntime'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/experimental/lazy/import': {
          libraryName: ['ReactLynx', 'ReactLazyImport'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/legacy-react-runtime': {
          libraryName: ['ReactLynx', 'ReactLegacyRuntime'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/runtime-components': {
          libraryName: ['ReactLynx', 'ReactComponents'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/worklet-runtime/bindings': {
          libraryName: ['ReactLynx', 'ReactWorkletRuntime'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        '@lynx-js/react/debug': {
          libraryName: ['ReactLynx', 'ReactDebug'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        preact: {
          libraryName: ['ReactLynx', 'Preact'],
          url: `${EXTERNAL_BUNDLE_PREFIX}/react.lynx.bundle`,
          background: { sectionPath: 'ReactLynx' },
          mainThread: { sectionPath: 'ReactLynx__main-thread' },
          async: false,
        },
        './App.js': {
          libraryName: 'CompLib',
          url: `${EXTERNAL_BUNDLE_PREFIX}/comp-lib.lynx.bundle`,
          background: { sectionPath: 'CompLib' },
          mainThread: { sectionPath: 'CompLib__main-thread' },
          async: true,
        },
      },
      globalObject: 'globalThis',
    }),
  ],
  environments: {
    web: {},
    lynx: {
      performance: {
        profile: enableBundleAnalysis,
      },
    },
  },
  server: {
    port: PORT,
  },
  output: {
    filenameHash: 'contenthash:8',
    cleanDistPath: false,
  },
});

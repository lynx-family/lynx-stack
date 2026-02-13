import { defineConfig, type RsbuildPlugin } from '@rslib/core';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;

const pluginCargoBuild = {
  name: 'plugin-cargo-build',
  setup(api) {
    api.onBeforeBuild(() => {
      execSync(
        `cargo build --release --target wasm32-unknown-unknown --features noop`,
        {
          env: {
            ...process.env,
            RUSTFLAGS: '-C link-arg=--export-table -C link-arg=-s --cfg getrandom_backend="custom"',
          },
          stdio: 'inherit',
          cwd: root,
        },
      );
    });
  },
} satisfies RsbuildPlugin;

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: 'es2022',
      dts: false,
    },
  ],
  source: {
    entry: {
      wasm: './src/wasm.js',
    },
  },
  output: {
    target: 'node',
    distPath: {
      root: './dist',
    },
    cleanDistPath: false,
    filename: {
      js: '[name].cjs',
    },
  },
  plugins: [pluginCargoBuild],
  tools: {
    rspack: {
      resolve: {
        alias: {
          '#react_transform.wasm': path.resolve(
            root,
            '../../../target/wasm32-unknown-unknown/release/react_transform.wasm',
          ),
        },
      },
      resolveLoader: {
        alias: {
          'buffer-loader': path.resolve(__dirname, 'scripts/buffer-loader.cjs'),
        },
      },
      module: {
        rules: [
          {
            test: /\.wasm$/,
            use: ['buffer-loader'],
            type: 'javascript/auto',
          },
        ],
      },
    },
  },
});

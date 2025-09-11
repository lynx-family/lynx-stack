// run command and dump output
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..');
const cargoOutput = path.join(
  '..',
  '..',
  '..',
  'target',
  'wasm32-unknown-unknown',
  'release',
  'web_style_transformer.wasm',
);
// build the standard wasm package
execSync(
  `cargo build --release --target wasm32-unknown-unknown`,
  { cwd: packageRoot, stdio: 'inherit' },
);
execSync(
  `wasm-bindgen --out-dir dist --target bundler --out-name standard ${cargoOutput}`,
  { cwd: packageRoot, stdio: 'inherit' },
);
execSync(
  `pnpm wasm-opt --enable-bulk-memory ./dist/standard_bg.wasm -O3 -o ./dist/standard_bg.wasm`,
  { cwd: packageRoot, stdio: 'inherit' },
);

// build the legacy wasm package
execSync(
  `cargo build --release --target wasm32-unknown-unknown`,
  {
    env: { ...process.env, RUSTFLAGS: '-Cstrip=symbols' },
    cwd: packageRoot,
    stdio: 'inherit',
  },
);
execSync(
  `wasm-bindgen --out-dir dist --target bundler --out-name legacy ${cargoOutput}`,
  { cwd: packageRoot, stdio: 'inherit' },
);
execSync(
  `pnpm wasm-opt --enable-bulk-memory ./dist/legacy_bg.wasm -O3 -o ./dist/legacy_bg.wasm`,
  { cwd: packageRoot, stdio: 'inherit' },
);

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
  'web_core_wasm.wasm',
);
const cargoOutputDebug = path.join(
  '..',
  '..',
  '..',
  'target',
  'wasm32-unknown-unknown',
  'debug',
  'web_core_wasm.wasm',
);
// build the standard wasm package
execSync(
  `RUSTFLAGS="-C target_feature=+simd128" cargo build  --release --target wasm32-unknown-unknown `,
  { cwd: packageRoot, stdio: 'inherit' },
);
execSync(
  `pnpm exec dotslash ./scripts/wasm-bindgen --out-dir dist --target bundler --out-name standard ${cargoOutput}`,
  { cwd: packageRoot, stdio: 'inherit' },
);
/**
 * https://webassembly.org/features/
 * https://doc.rust-lang.org/reference/attributes/codegen.html#wasm32-or-wasm64
 * https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html
 * feature    |   chrome | firefox |  safari
 * bulk-memory|   75     |  79     |   15
 * sign-ext   |   74     |  62     |   14.1
 * simd       |   91     |  89     |   16.4
 * ref-typs   |   96     |  79     |   15
 * multivalue |   85     |  78     |   13.1
 * nontrapping-float-to-int | 75 | 64 | 15
 * mutable-globals | 74 | 61 | 13.1
 */
execSync(
  `pnpm wasm-opt --enable-bulk-memory --enable-bulk-memory-opt --enable-sign-ext --enable-simd --enable-reference-types --enable-nontrapping-float-to-int --enable-mutable-globals ./dist/standard_bg.wasm -O3 -o ./dist/standard_bg.wasm`,
  { cwd: packageRoot, stdio: 'inherit' },
);

// build the debug wasm package
execSync(
  `cargo build --target wasm32-unknown-unknown`,
  { cwd: packageRoot, stdio: 'inherit' },
);
execSync(
  `pnpm exec dotslash ./scripts/wasm-bindgen --keep-debug --out-dir dist --target bundler --out-name debug ${cargoOutputDebug}`,
  { cwd: packageRoot, stdio: 'inherit' },
);

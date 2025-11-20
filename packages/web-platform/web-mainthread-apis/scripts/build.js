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
  'web_mainthread_apis.wasm',
);
const cargoOutputDebug = path.join(
  '..',
  '..',
  '..',
  'target',
  'wasm32-unknown-unknown',
  'debug',
  'web_mainthread_apis.wasm',
);
// build the standard wasm package

function build(release, rustFlags, outName, optimizeArgs, rust_features) {
  execSync(
    `cargo build ${
      release ? '--release' : ''
    } --target wasm32-unknown-unknown  ${
      rust_features ? `--features ${rust_features}` : ''
    }`,
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: { ...process.env, RUSTFLAGS: rustFlags },
      shell: true,
    },
  );
  execSync(
    `pnpm exec dotslash ./scripts/wasm-bindgen ${
      release ? '' : '--keep-debug'
    } --out-dir binary --target bundler --out-name ${outName} ${
      release ? cargoOutput : cargoOutputDebug
    }`,
    { cwd: packageRoot, stdio: 'inherit' },
  );
  if (release) {
    execSync(
      `pnpm wasm-opt --enable-bulk-memory  ${optimizeArgs} ./binary/${outName}_bg.wasm -o ./binary/${outName}_bg.wasm`,
      { cwd: packageRoot, stdio: 'inherit' },
    );
  }
}
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

build(
  true,
  '-C target_feature=+bulk-memory,+sign-ext,+simd128,+reference-types,+nontrapping-fptoint,+mutable-globals',
  'standard',
  '--enable-bulk-memory-opt --enable-sign-ext --enable-simd --enable-reference-types --enable-nontrapping-float-to-int --enable-mutable-globals',
);
build(
  true,
  '-C target_feature=+bulk-memory -C strip=symbols',
  'legacy',
  '',
);
build(false, '', 'debug', '');

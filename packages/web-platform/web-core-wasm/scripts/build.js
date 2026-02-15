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

function build(
  featureName,
  rustFlags,
  wasmBindgenArgs,
  optimizeArgs,
  isNode = false,
) {
  const outDir = path.join(packageRoot, 'binary', featureName);
  const outputWasmName = `${featureName}`;
  const outputWasmDebugName = `${featureName}_debug`;
  const outputWasm = path.join(outDir, outputWasmName);
  const outputWasmDebug = path.join(outDir, outputWasmDebugName);
  // build release
  execSync(
    `cargo build --release --target wasm32-unknown-unknown  --features ${featureName}`,
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: { ...process.env, RUSTFLAGS: rustFlags },
      shell: true,
    },
  );
  execSync(
    `pnpm exec dotslash ./scripts/wasm-bindgen ${wasmBindgenArgs} --out-dir ${outDir} --target ${
      isNode ? 'experimental-nodejs-module' : 'web'
    } --out-name ${outputWasmName} ${cargoOutput}`,
    { cwd: packageRoot, stdio: 'inherit' },
  );
  execSync(
    `pnpm wasm-opt --enable-bulk-memory  ${optimizeArgs} ${outputWasm}_bg.wasm -O4 -o ${outputWasm}_bg.wasm`,
    { cwd: packageRoot, stdio: 'inherit' },
  );
  // build debug
  execSync(
    `cargo build --target wasm32-unknown-unknown  --features ${featureName}`,
    {
      cwd: packageRoot,
      stdio: 'inherit',
      env: { ...process.env, RUSTFLAGS: rustFlags },
      shell: true,
    },
  );
  execSync(
    `pnpm exec dotslash ./scripts/wasm-bindgen ${wasmBindgenArgs} --keep-debug --out-dir ${outDir} --target ${
      isNode ? 'experimental-nodejs-module' : 'web'
    } --out-name ${outputWasmDebugName} ${cargoOutputDebug}`,
    { cwd: packageRoot, stdio: 'inherit' },
  );
}
/**
 * https://webassembly.org/features/
 * https://doc.rust-lang.org/reference/attributes/codegen.html#wasm32-or-wasm64
 * https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html
 * feature    |   chrome | firefox |  safari
 * bulk-memory|   75     |  79     |   15
 * sign-ext   |   74     |  62     |   14.1
 * simd       |   91     |  89     |   16.4
 * ref-types  |   96     |  79     |   15
 * multivalue |   85     |  78     |   13.1
 * nontrapping-float-to-int | 75 | 64 | 15
 * mutable-globals | 74 | 61 | 13.1
 */

build(
  'client',
  '-C target_feature=+bulk-memory,+sign-ext,+simd128,+reference-types,+nontrapping-fptoint,+mutable-globals',
  '',
  '--enable-bulk-memory-opt --enable-sign-ext --enable-simd --enable-reference-types --enable-nontrapping-float-to-int --enable-mutable-globals',
);
build(
  'server',
  '-C target_feature=+bulk-memory,+sign-ext,+simd128,+reference-types,+nontrapping-fptoint,+mutable-globals',
  '',
  '--enable-bulk-memory-opt --enable-sign-ext --enable-simd --enable-reference-types --enable-nontrapping-float-to-int --enable-mutable-globals',
  true,
);
build('encode', '', '', '--all-features', true);

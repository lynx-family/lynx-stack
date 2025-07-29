// run command and dump output
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.join(__dirname, '..');
execSync(
  `wasm-pack build --target bundler --out-dir dist --out-name standard --mode no-install`,
  { cwd: packageRoot, stdio: 'inherit' },
);
execSync(
  `wasm-pack build --target bundler --out-dir dist --out-name legacy --mode no-install`,
  {
    env: { ...process.env, RUSTFLAGS: '-Cstrip=symbols' },
    cwd: packageRoot,
    stdio: 'inherit',
  },
);
fs.rmSync(path.join(packageRoot, 'dist', '.gitignore'), { force: true });

// Execute the wasm-opt command to ensure it works
execSync('wasm-opt --version', {
  stdio: 'inherit',
  cwd: packageRoot,
});

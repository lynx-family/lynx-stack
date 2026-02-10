// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { $ } from 'zx';

if (
  !process.env.CI
  // rspack-ecosystem-ci would set this
  // https://github.com/rspack-contrib/rspack-ecosystem-ci/blob/113d2338da254ca341313a4a54afe789b45b1508/utils.ts#L108
  || process.env['ECOSYSTEM_CI']
) {
  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
}

if (process.platform === 'win32') {
  // create a noop binary for windows

  mkdirSync('./dist/bin', { recursive: true });
  writeFileSync(
    './dist/bin/benchx_cli',
    `\
#!/usr/bin/env node

console.log('noop')
`,
  );

  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
}

const COMMIT = '25af017a126ed087ba1bf276639f4a0b60b348fc';
const PICK_COMMIT = '26f5fa8f92c517bce0550c34ff7a43f06c2df705';

function checkCwd() {
  try {
    if (
      JSON.parse(
        readFileSync(
          path.join(process.cwd(), 'package.json'),
          'utf-8',
        ).toString(),
      ).name === 'benchx_cli'
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function checkBinary() {
  if (
    existsSync('./dist/bin/benchx_cli')
    && existsSync('./dist/bin/benchx_cli.commit')
  ) {
    const { exitCode, stdout } = await $`cat ./dist/bin/benchx_cli.commit`;
    if (exitCode === 0 && stdout.trim() === COMMIT) {
      return true;
    }
  }
  return false;
}

if (!checkCwd()) {
  throw new Error(
    'This script must be run from `packages/lynx/benchx_cli` dir',
  );
}

if (await checkBinary()) {
  console.info('Binary is up to date');
  // eslint-disable-next-line n/no-process-exit
  process.exit(0);
}

await $`
rm -rf dist
rm -rf habitat
rm -rf lynx
`;

// prepare the lynx repo
await $`
mkdir -p lynx
cd lynx
git init -b main
git remote add origin https://github.com/lynx-family/lynx
git fetch origin ${COMMIT}
git checkout ${COMMIT}
git remote add lynx-community https://github.com/lynx-community/benchx_cli
git fetch lynx-community ${PICK_COMMIT}
git cherry-pick -n ${PICK_COMMIT}
`.pipe(process.stdout);

// hab sync .
await $`
set +u
cd lynx
uv venv .venv
source .venv/bin/activate
uv pip install pip
source tools/envsetup.sh
tools/hab sync .
`.pipe(process.stdout);

// build from source
await $`
set +u
cd lynx
source tools/envsetup.sh
gn gen --args=${
  process.platform === 'darwin'
    ? `enable_unittests=true enable_trace="perfetto" jsengine_type="quickjs" enable_frozen_mode=true use_flutter_cxx=false`
    : `enable_unittests=true enable_trace="perfetto" jsengine_type="quickjs" enable_frozen_mode=true`
} out/Default
ninja -C out/Default benchx_cli
mkdir -p ../dist/bin
cp out/Default/benchx_cli ../dist/bin/benchx_cli
git rev-parse HEAD > ../dist/bin/benchx_cli.commit
rm -rf out
`.pipe(process.stdout);

// cleanup
await $`
rm -rf habitat
rm -rf lynx
`;

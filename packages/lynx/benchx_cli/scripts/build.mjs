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

const COMMIT = 'd6dd806293012c62e5104ad7ed2bed5c66f4f833';
const PICK_COMMIT = 'ce49dc44c73bb26bb6c1cc56d0ae86fa45cc254c';

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

// We build habitat from source to workaround a bug
await $`
git clone --branch=0.3.142 --depth=1 https://github.com/lynx-family/habitat
cd habitat
uv venv venv
source venv/bin/activate
uv pip install .
`.pipe(process.stdout);

// prepare the lynx repo
await $`
git clone https://github.com/lynx-family/lynx
cd lynx
git fetch origin ${COMMIT}
git checkout ${COMMIT}
git remote add hzy https://github.com/hzy/lynx
git fetch hzy ${PICK_COMMIT}
git cherry-pick -n ${PICK_COMMIT}
`.pipe(process.stdout);

// hab sync .
await $`
cd lynx
uv venv .venv
source .venv/bin/activate
uv pip install pip
source tools/envsetup.sh
../habitat/venv/bin/hab sync .
`.pipe(process.stdout);

// build from source
await $`
cd lynx
source tools/envsetup.sh
gn gen --args='enable_unittests=true enable_trace="perfetto" jsengine_type="quickjs" enable_frozen_mode=true' out/Default
ninja -C out/Default benchx_cli
mkdir -p ../dist/bin
cp ${
  process.platform === 'darwin'
    ? 'out/Default/benchx_cli'
    : 'out/Default/exe.unstripped/benchx_cli' // linux
} ../dist/bin/benchx_cli
git rev-parse HEAD > ../dist/bin/benchx_cli.commit
rm -rf out
`.pipe(process.stdout);

// cleanup
await $`
rm -rf habitat
rm -rf lynx
`;

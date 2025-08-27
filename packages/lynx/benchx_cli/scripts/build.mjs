// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { $ } from 'zx';

if (!process.env.CI) {
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

const COMMIT = 'fd5f6d5a8f1c27cdeba51e55414c6e96f7ef5558';

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
python3 -m venv venv
source venv/bin/activate
pip install .
`.pipe(process.stdout);

// hab sync .
await $`
git clone https://github.com/hzy/lynx
cd lynx
git fetch origin ${COMMIT}
git checkout ${COMMIT}
source tools/envsetup.sh
../habitat/venv/bin/hab sync .
`.pipe(process.stdout);

// build from source
await $`
cd lynx
source tools/envsetup.sh
gn gen --args='enable_unittests=true enable_trace="perfetto"' out/Default
ninja -C out/Default benchx_cli
mkdir -p ../dist/bin
cp out/Default/exe.unstripped/benchx_cli ../dist/bin/benchx_cli
ls -lha out/Default/benchx_cli
ls -lha out/Default/exe.unstripped/benchx_cli
git rev-parse HEAD > ../dist/bin/benchx_cli.commit
rm -rf out
`.pipe(process.stdout);

// cleanup
await $`
rm -rf habitat
rm -rf lynx
`;

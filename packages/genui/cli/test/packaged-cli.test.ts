// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, expect, test } from '@rstest/core';

const tempDirs: string[] = [];
const cliDir = fileURLToPath(new URL('../', import.meta.url));

afterAll(() => {
  for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

test.each(['1.2.3', '0.0.0-preview-eb52d1c'])(
  'uses the published umbrella manifest for version %s',
  version => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genui-packed-cli-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'cli/dist/a2ui'), { recursive: true });
    for (const file of ['utils.js', 'a2ui/create.js']) {
      fs.copyFileSync(
        path.join(cliDir, 'dist', file),
        path.join(dir, 'cli/dist', file),
      );
    }
    fs.mkdirSync(path.join(dir, 'cli/templates/default'), { recursive: true });
    fs.copyFileSync(
      path.join(cliDir, 'templates/default/package.json'),
      path.join(dir, 'cli/templates/default/package.json'),
    );
    const react = version === '1.2.3'
      ? '^0.121.0'
      : 'https://pkg.pr.new/lynx-family/lynx-stack/@lynx-js/react@eb52d1c';
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({
        name: '@lynx-js/genui',
        type: 'module',
        version,
        repository: { url: 'https://github.com/lynx-family/lynx-stack.git' },
        devDependencies: { '@lynx-js/react': react },
      }),
    );
    // The public tarball does not contain cli/package.json or workspace links.
    const output = execFileSync(process.execPath, [
      '--input-type=module',
      '-e',
      `
      import { printPackageVersion } from ${
        JSON.stringify(pathToFileURL(path.join(dir, 'cli/dist/utils.js')).href)
      };
      import { runA2UICreateCli } from ${
        JSON.stringify(
          pathToFileURL(path.join(dir, 'cli/dist/a2ui/create.js')).href,
        )
      };
      printPackageVersion();
      runA2UICreateCli(['app'], ${JSON.stringify(dir)}, {programName: 'genui'});
    `,
    ], { encoding: 'utf8' });
    expect(output.split('\n')[0]).toBe(version);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'app/package.json'), 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies['@lynx-js/genui']).toBe(
      version === '1.2.3'
        ? '^1.2.3'
        : 'https://pkg.pr.new/lynx-family/lynx-stack/@lynx-js/genui@eb52d1c',
    );
    expect(manifest.dependencies['@lynx-js/react']).toBe(react);
    if (version === '1.2.3') {
      expect(output).not.toContain('--config.blockExoticSubdeps=false');
    } else {
      expect(output).toContain(
        'pnpm install --config.blockExoticSubdeps=false',
      );
    }
  },
);

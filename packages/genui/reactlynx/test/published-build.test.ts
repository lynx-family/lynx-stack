// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { expect, test } from '@rstest/core';

const runNode = promisify(execFile);
const genuiRoot = fileURLToPath(new URL('../../', import.meta.url));

test(
  'builds Web and Native bundles from the published umbrella layout',
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'genui-published-'));
    try {
      const packageRoot = path.join(directory, 'node_modules/@lynx-js/genui');
      await mkdir(packageRoot, { recursive: true });
      await copyFile(
        path.join(genuiRoot, 'package.json'),
        path.join(packageRoot, 'package.json'),
      );
      const dist = path.join(genuiRoot, 'reactlynx/dist');
      for (
        const file of await readdir(dist, {
          recursive: true,
          withFileTypes: true,
        })
      ) {
        if (!file.isFile()) continue;
        const source = path.join(file.parentPath, file.name);
        const destination = path.join(
          packageRoot,
          'reactlynx/dist',
          path.relative(dist, source),
        );
        await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(source, destination);
      }
      // Installed dependencies belong to the umbrella, not the nested private package.
      await symlink(
        path.join(genuiRoot, 'node_modules'),
        path.join(packageRoot, 'node_modules'),
        'dir',
      );
      await writeFile(
        path.join(directory, 'build.mjs'),
        `
import { buildReactLynx, parseReactLynxSource, REACTLYNX_SYSTEM_PROMPT } from '@lynx-js/genui/reactlynx';
if (!REACTLYNX_SYSTEM_PROMPT.includes('App.tsx')) throw new Error('Missing prompt');
const statuses = [];
const assets = await buildReactLynx(parseReactLynxSource(JSON.stringify({ files: {
  'App.tsx': "import { useState } from '@lynx-js/react'; export default function App() { const [count, setCount] = useState(0); return <view className='page'><text bindtap={() => setCount(count + 1)}>{count}</text></view>; }",
  'App.css': '.page { display: flex; flex-direction: column; padding: 24px; }',
} })), new AbortController().signal, status => statuses.push(status));
console.log('BUILD_RESULT:' + JSON.stringify({ statuses, assets: assets.map(asset => ({ name: asset.name, bytes: asset.data.length })) }));
`,
      );
      const { stdout } = await runNode(process.execPath, ['build.mjs'], {
        cwd: directory,
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      });
      const result = JSON.parse(stdout.split('BUILD_RESULT:')[1]!.trim()) as {
        statuses: string[];
        assets: Array<{ name: string; bytes: number }>;
      };
      expect(result.statuses).toEqual(['queued', 'building']);
      expect(result.assets.map(asset => asset.name)).toEqual(
        expect.arrayContaining(['main.web.js', 'main.lynx.js']),
      );
      expect(result.assets.every(asset => asset.bytes > 0)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  120_000,
);

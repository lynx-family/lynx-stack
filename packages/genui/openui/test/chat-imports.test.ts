// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, beforeAll, expect, test } from '@rstest/core';

const runNode = promisify(execFile);
const genuiRoot = fileURLToPath(new URL('../../', import.meta.url));
const fixtures = fileURLToPath(
  new URL('./fixtures/chat-imports/', import.meta.url),
);
let directory: string;

async function copyDirectory(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true });
  for (const file of await readdir(source, { withFileTypes: true })) {
    const from = path.join(source, file.name);
    const to = path.join(target, file.name);
    if (file.isDirectory()) await copyDirectory(from, to);
    else await copyFile(from, to);
  }
}

function componentStyles(modules: string[]): string[] {
  return [
    ...new Set(
      modules
        .filter(name => name.includes('/openui/styles/catalog/'))
        .map(name => path.basename(name)),
    ),
  ].sort();
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'openui-chat-imports-'));
  const packageRoot = path.join(directory, 'node_modules/@lynx-js/genui');
  const privateRoot = path.join(
    directory,
    'node_modules/@lynx-js/genui-openui',
  );
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  for (
    const [source, target, nested] of [
      [genuiRoot, packageRoot, 'openui'],
      [path.join(genuiRoot, 'openui'), privateRoot, ''],
    ] as const
  ) {
    await mkdir(target, { recursive: true });
    await copyFile(
      path.join(source, 'package.json'),
      path.join(target, 'package.json'),
    );
    for (const folder of ['dist', 'styles']) {
      await copyDirectory(
        path.join(genuiRoot, 'openui', folder),
        path.join(target, nested, folder),
      );
    }
  }
  // Resolve each dependency before linking it into the isolated consumer.
  // Whole node_modules junctions do not reliably resolve pnpm links on Windows.
  for (
    const [source, dependencies] of [
      [genuiRoot, [
        '@lynx-js/react-rsbuild-plugin',
        '@lynx-js/rspeedy',
        'typescript',
      ]],
      [path.join(genuiRoot, 'openui'), [
        '@lynx-js/lynx-ui',
        '@lynx-js/react',
        '@openuidev/lang-core',
        'marked',
        'zod',
      ]],
    ] as const
  ) {
    for (const dependency of dependencies) {
      const target = path.join(directory, 'node_modules', dependency);
      await mkdir(path.dirname(target), { recursive: true });
      await symlink(
        await realpath(path.join(source, 'node_modules', dependency)),
        target,
        linkType,
      );
    }
  }
  for (const file of ['check-exports.mjs', 'build.mjs']) {
    await copyFile(path.join(fixtures, file), path.join(directory, file));
  }
  await copyDirectory(path.join(fixtures, 'app'), path.join(directory, 'app'));
});

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

test(
  'all published and workspace Chat subpaths resolve with types and headless contracts',
  async () => {
    const { stdout } = await runNode(process.execPath, [
      path.join(directory, 'check-exports.mjs'),
    ], {
      cwd: directory,
      timeout: 30_000,
    });
    expect(stdout.trim()).toBe('Chat subpaths and declarations verified');
  },
  30_000,
);

test(
  'production Web and Native bundles retain only selected Chat styles and dependencies',
  async () => {
    const { stdout } = await runNode(process.execPath, [
      path.join(directory, 'build.mjs'),
    ], {
      cwd: directory,
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const results = JSON.parse(
      stdout.split('CHAT_BUNDLES:')[1]!.trim(),
    ) as Record<
      'selected' | 'markdown' | 'full',
      Record<'web' | 'lynx', { css: string; modules: string[]; bytes: number }>
    >;
    for (const platform of ['web', 'lynx'] as const) {
      const selected = results.selected[platform];
      const markdown = results.markdown[platform];
      const full = results.full[platform];
      for (const result of [selected, markdown, full]) {
        expect(result.bytes).toBeGreaterThan(0);
        expect(result.css).toContain('.OpenUIChatCard');
        expect(result.modules.join('\n')).not.toMatch(/openui\/src\//u);
      }
      expect(selected.css).toContain('.OpenUIChatText');
      expect(selected.css).toContain('.OpenUIButton');
      expect(componentStyles(selected.modules)).toEqual([
        'Button.css',
        'ChatCard.css',
        'ChatText.css',
      ]);
      expect(componentStyles(markdown.modules)).toEqual([
        'ChatCard.css',
        'ChatMarkdown.css',
      ]);
      expect(selected.css).not.toMatch(
        /OpenUIChat(?:Markdown|Slider|Table|Form|ImageText)/u,
      );
      expect(selected.modules.join('\n')).not.toMatch(
        /(?:marked\/|chat\/(?:index|components)\.js|catalog\/index\.js)/u,
      );
      expect(markdown.css).toContain('.OpenUIChatMarkdown');
      expect(markdown.css).not.toMatch(
        /OpenUIChat(?:Slider|Table|Form|ImageText)|\.OpenUIButton/u,
      );
      expect(markdown.modules.some(name => name.includes('/marked/'))).toBe(
        true,
      );
      expect(full.css).toMatch(/OpenUIChatSlider/u);
      expect(full.css).toMatch(/OpenUIChatTable/u);
      expect(full.css).toMatch(/OpenUIChatImageText/u);
      expect(selected.bytes).toBeLessThan(full.bytes);
      expect(selected.css.length).toBeLessThan(full.css.length);
    }
  },
  120_000,
);

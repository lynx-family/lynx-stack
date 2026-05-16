// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CliPrompts, CliRuntime } from '../src/cli.js';
import {
  isCliEntrypoint,
  main,
  parseArgs,
  reportCliError,
} from '../src/cli.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { force: true, recursive: true });
  }

  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe('create-lynx-extension CLI', () => {
  it('parses positional and flag options', () => {
    expect(
      parseArgs([
        'demo-extension',
        '--types',
        'native-module,element',
        '--type',
        'service',
        '--package-name',
        '@example/demo-extension',
        '--android-package',
        'com.example.demo',
        '--module-name',
        'DemoModule',
        '--element-name',
        'x-demo',
        '--service-name',
        'DemoService',
      ]),
    ).toEqual({
      help: false,
      dir: 'demo-extension',
      types: ['native-module', 'element', 'service'],
      packageName: '@example/demo-extension',
      androidPackage: 'com.example.demo',
      moduleName: 'DemoModule',
      elementName: 'x-demo',
      serviceName: 'DemoService',
    });
  });

  it('rejects malformed arguments clearly', () => {
    expect(() => parseArgs(['--unknown'])).toThrow(/Unknown option/);
    expect(() => parseArgs(['first', 'second'])).toThrow(
      /Unexpected positional argument/,
    );
    expect(() => parseArgs(['--dir'])).toThrow(/--dir requires a value/);
    expect(() => parseArgs(['--types', '--dir'])).toThrow(
      /--types requires a value/,
    );
  });

  it('prints help without creating files', async () => {
    const runtime = createRuntime();

    await main(['--help'], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('Usage: create-lynx-extension'),
    );
  });

  it('creates a scaffold from non-interactive flags', async () => {
    const dir = createTempPath('cli-extension');
    const runtime = createRuntime();

    await main([
      '--dir',
      dir,
      '--types',
      'native-module,element',
      '--package-name',
      '@example/cli-extension',
      '--android-package',
      'com.example.cli',
      '--module-name',
      'CliModule',
      '--element-name',
      'x-cli',
      '--service-name',
      'CliService',
    ], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining(`Created 19 files in ${path.resolve(dir)}`),
    );
    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Extension types:\n  - Native Module\n  - Element',
      ),
    );
    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('Next steps:'),
    );
    expect(read(dir, 'package.json')).toContain(
      '"name": "@example/cli-extension"',
    );
    expect(read(dir, 'android/src/main/java/com/example/cli/CliModule.java'))
      .toContain('@LynxAutolinkNativeModule(name = "CliModule")');
    expect(read(dir, 'ios/src/CliElement.h')).toContain(
      '@LynxAutolinkUI("x-cli")',
    );
  });

  it('creates an all-in-one scaffold from the shorthand type flag', async () => {
    const dir = createTempPath('all-extension');
    const runtime = createRuntime();

    await main([
      '--dir',
      dir,
      '--types',
      'all',
      '--package-name',
      '@example/all-extension',
      '--android-package',
      'com.example.all',
    ], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('  - Native Module\n  - Element\n  - Service'),
    );
    expect(
      read(
        dir,
        'android/src/main/java/com/example/all/AllExtensionModule.java',
      ),
    )
      .toContain('@LynxAutolinkNativeModule(name = "AllExtensionModule")');
    expect(
      read(
        dir,
        'android/src/main/java/com/example/all/AllExtensionElement.java',
      ),
    )
      .toContain('@LynxAutolinkElement(name = "x-all-extension")');
    expect(
      read(
        dir,
        'android/src/main/java/com/example/all/AllExtensionService.java',
      ),
    )
      .toContain('@LynxAutolinkService');
  });

  it('fails in non-interactive mode when required options are missing', async () => {
    await expect(main([], createRuntime())).rejects.toThrow(
      /Missing required options in non-interactive mode: --dir, --types/,
    );
  });

  it('prompts with project text and extension type multiselect controls', async () => {
    const dir = createTempPath('interactive-extension');
    const textPrompt = vi.fn().mockResolvedValue(dir);
    const multiselectPrompt = vi.fn().mockResolvedValue([
      'native-module',
      'element',
      'service',
    ]);
    const runtime = createRuntime({
      isTTY: true,
      prompts: {
        text: textPrompt as CliPrompts['text'],
        multiselect: multiselectPrompt as CliPrompts['multiselect'],
      },
    });

    await main([], runtime);

    expect(textPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultValue: 'lynx-extension',
        message: 'Project name or path',
        placeholder: 'lynx-extension',
      }),
    );
    expect(multiselectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValues: ['native-module', 'element', 'service'],
        required: true,
      }),
    );
    const multiselectOptions = multiselectPrompt.mock.calls[0]?.[0] as
      | { message?: string }
      | undefined;
    expect(multiselectOptions?.message).toContain('Select extension types');
    expect(multiselectPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        options: [
          expect.objectContaining({
            label: 'Native Module',
            value: 'native-module',
          }),
          expect.objectContaining({ label: 'Element', value: 'element' }),
          expect.objectContaining({ label: 'Service', value: 'service' }),
        ],
      }),
    );
    expect(read(dir, 'ios/src/InteractiveExtensionService.h')).toContain(
      '@protocol InteractiveExtensionServiceProtocol',
    );
  });

  it('rejects empty interactive type answers', async () => {
    const dir = createTempPath('interactive-extension');
    const runtime = createRuntime({
      isTTY: true,
      prompts: {
        text: vi.fn().mockResolvedValue(dir) as CliPrompts['text'],
        multiselect: vi.fn().mockResolvedValue([]) as CliPrompts[
          'multiselect'
        ],
      },
    });

    await expect(main(['--dir', dir], runtime)).rejects.toThrow(
      /At least one extension type is required/,
    );
  });

  it('normalizes executable errors', () => {
    const runtime = createRuntime();

    reportCliError(new Error('native failure'), runtime);
    expect(runtime.error).toHaveBeenCalledWith('native failure');
    expect(process.exitCode).toBe(1);

    process.exitCode = undefined;
    reportCliError('string failure', runtime);
    expect(runtime.error).toHaveBeenCalledWith('string failure');
    expect(process.exitCode).toBe(1);
  });

  it('recognizes npm bin symlinks as executable entrypoints', () => {
    const binPath = path.join('node_modules', '.bin', 'create-lynx-extension');
    const cliPath = path.join(
      'node_modules',
      'create-lynx-extension',
      'dist',
      'cli.js',
    );
    const resolvedCliPath = path.resolve(cliPath);

    vi.spyOn(fs, 'realpathSync').mockImplementation(
      ((filePath) => {
        const resolvedPath = path.resolve(String(filePath));

        if (resolvedPath === path.resolve(binPath)) {
          return resolvedCliPath;
        }

        return resolvedPath;
      }) as typeof fs.realpathSync,
    );

    expect(isCliEntrypoint(binPath, pathToFileURL(resolvedCliPath).href))
      .toBe(true);
  });
});

function createRuntime(
  options: { isTTY?: boolean; prompts?: CliPrompts } = {},
): CliRuntime {
  const input = new PassThrough() as PassThrough & { isTTY?: boolean };
  const output = new PassThrough() as PassThrough & { isTTY?: boolean };
  input.isTTY = options.isTTY ?? false;
  output.isTTY = options.isTTY ?? false;

  return {
    input,
    output,
    info: vi.fn(),
    error: vi.fn(),
    ...(options.prompts === undefined ? {} : { prompts: options.prompts }),
  };
}

function createTempPath(name: string): string {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-extension-cli-'));
  tempDirs.push(parent);
  return path.join(parent, name);
}

function read(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

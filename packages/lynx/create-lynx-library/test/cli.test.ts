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

describe('create-lynx-library CLI', () => {
  it('parses positional and flag options', () => {
    expect(
      parseArgs([
        'demo-library',
        '--features',
        'native-module,element',
        '--feature',
        'service',
        '--platforms',
        'android',
        '--platform',
        'ios',
        '--platform',
        'lynxtron',
        '--package-name',
        '@example/demo-library',
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
      dir: 'demo-library',
      features: ['native-module', 'element', 'service'],
      platforms: ['android', 'ios', 'lynxtron'],
      packageName: '@example/demo-library',
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
    expect(() => parseArgs(['--features', '--dir'])).toThrow(
      /--features requires a value/,
    );
    expect(() => parseArgs(['--platforms', '--dir'])).toThrow(
      /--platforms requires a value/,
    );
    expect(() => parseArgs(['--platforms', 'web'])).toThrow(
      /Unsupported Native platform/,
    );
  });

  it('prints help without creating files', async () => {
    const runtime = createRuntime();

    await main(['--help'], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('Usage: create-lynx-library'),
    );
  });

  it('creates a scaffold from non-interactive flags', async () => {
    const dir = createTempPath('cli-library');
    const runtime = createRuntime();

    await main([
      '--dir',
      dir,
      '--features',
      'native-module,element',
      '--package-name',
      '@example/cli-library',
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
      expect.stringContaining(`Created 33 files in ${path.resolve(dir)}`),
    );
    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Library features:\n  - Native Module\n  - Element',
      ),
    );
    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('Next steps:'),
    );
    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining(
        'Native platforms:\n  - Android\n  - iOS\n  - Lynxtron',
      ),
    );
    expect(read(dir, 'package.json')).toContain(
      '"name": "@example/cli-library"',
    );
    expect(read(dir, 'package.json')).not.toContain('workspace:');
    expect(read(dir, 'lynxtron/index.cjs')).toContain(
      '\'dist\'',
    );
    expect(read(dir, 'lynxtron/index.cjs')).toContain(
      '\'cli-library.node\'',
    );
    expect(read(dir, 'shared/CMakeLists.txt')).toContain(
      '@lynx-js/lynx-library-headers',
    );
    expect(read(dir, 'android/src/main/java/com/example/cli/CliModule.java'))
      .toContain('@LynxNativeModule(name = "CliModule")');
    expect(read(dir, 'ios/src/CliElement.h')).toContain(
      '@LynxUIRegister("x-cli")',
    );
  });

  it('creates a scaffold for an explicit Native platform', async () => {
    const dir = createTempPath('android-library');
    const runtime = createRuntime();

    await main([
      '--dir',
      dir,
      '--features',
      'native-module',
      '--platforms',
      'android',
      '--package-name',
      '@example/android-library',
      '--android-package',
      'com.example.android',
      '--module-name',
      'AndroidModule',
    ], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('Native platforms:\n  - Android'),
    );
    const message = vi.mocked(runtime.info).mock.calls[0]?.[0] ?? '';
    expect(message).not.toContain('  - iOS');
    expect(
      read(
        dir,
        'android/src/main/java/com/example/android/AndroidModule.java',
      ),
    )
      .toContain('@LynxNativeModule(name = "AndroidModule")');
    expect(fs.existsSync(path.join(dir, 'ios'))).toBe(false);
  });

  it('creates a scaffold for the Lynxtron platform', async () => {
    const dir = createTempPath('lynxtron-library');
    const runtime = createRuntime();

    await main([
      '--dir',
      dir,
      '--features',
      'native-module,element',
      '--platforms',
      'lynxtron',
      '--package-name',
      '@example/lynxtron-library',
      '--module-name',
      'LynxtronModule',
      '--element-name',
      'x-lynxtron',
    ], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining('Native platforms:\n  - Lynxtron'),
    );
    expect(fs.existsSync(path.join(dir, 'lynxtron/index.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'shared/CMakeLists.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'android'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'ios'))).toBe(false);
  });

  it('creates an all-in-one scaffold from the shorthand feature flag', async () => {
    const dir = createTempPath('all-library');
    const runtime = createRuntime();

    await main([
      '--dir',
      dir,
      '--features',
      'all',
      '--package-name',
      '@example/all-library',
      '--android-package',
      'com.example.all',
    ], runtime);

    expect(runtime.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '  - Native Module\n  - NAPI Native Module\n  - Element\n  - Service',
      ),
    );
    expect(
      read(
        dir,
        'android/src/main/java/com/example/all/AllLibraryModule.java',
      ),
    )
      .toContain('@LynxNativeModule(name = "AllLibraryModule")');
    expect(
      read(
        dir,
        'android/src/main/java/com/example/all/AllLibraryElement.java',
      ),
    )
      .toContain('@LynxElement(name = "x-all-library")');
    expect(
      read(
        dir,
        'android/src/main/java/com/example/all/AllLibraryService.java',
      ),
    )
      .toContain('@LynxService');
  });

  it('fails in non-interactive mode when required options are missing', async () => {
    await expect(main([], createRuntime())).rejects.toThrow(
      /Missing required options in non-interactive mode: --dir, --features/,
    );
  });

  it('prompts with project text, library feature, and Native platform controls', async () => {
    const dir = createTempPath('interactive-library');
    const textPrompt = vi.fn().mockResolvedValue(dir);
    const multiselectPrompt = vi.fn()
      .mockResolvedValueOnce([
        'native-module',
        'element',
        'service',
      ])
      .mockResolvedValueOnce(['android', 'ios']);
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
        defaultValue: 'lynx-library',
        message: 'Project name or path',
        placeholder: 'lynx-library',
      }),
    );
    expect(multiselectPrompt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        initialValues: [
          'native-module',
          'napi-native-module',
          'element',
          'service',
        ],
        required: true,
      }),
    );
    const featureOptions = multiselectPrompt.mock.calls[0]?.[0] as
      | { message?: string }
      | undefined;
    expect(featureOptions?.message).toContain('Select library features');
    expect(multiselectPrompt).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        options: [
          expect.objectContaining({
            label: 'Native Module',
            value: 'native-module',
          }),
          expect.objectContaining({
            label: 'NAPI Native Module',
            value: 'napi-native-module',
          }),
          expect.objectContaining({ label: 'Element', value: 'element' }),
          expect.objectContaining({ label: 'Service', value: 'service' }),
        ],
      }),
    );
    expect(multiselectPrompt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        required: true,
      }),
    );
    const platformOptions = multiselectPrompt.mock.calls[1]?.[0] as
      | { initialValues?: unknown; message?: string }
      | undefined;
    expect(platformOptions?.message).toContain('Select Native platforms');
    expect(platformOptions?.initialValues).toBeUndefined();
    expect(multiselectPrompt).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        options: [
          expect.objectContaining({ label: 'Android', value: 'android' }),
          expect.objectContaining({ label: 'iOS', value: 'ios' }),
          expect.objectContaining({ label: 'Lynxtron', value: 'lynxtron' }),
        ],
      }),
    );
    expect(read(dir, 'ios/src/InteractiveLibraryService.h')).toContain(
      '@protocol InteractiveLibraryServiceProtocol',
    );
  });

  it('rejects empty interactive feature answers', async () => {
    const dir = createTempPath('interactive-library');
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
      /At least one library feature is required/,
    );
  });

  it('rejects empty interactive Native platform answers', async () => {
    const dir = createTempPath('interactive-library');
    const runtime = createRuntime({
      isTTY: true,
      prompts: {
        text: vi.fn().mockResolvedValue(dir) as CliPrompts['text'],
        multiselect: vi.fn()
          .mockResolvedValueOnce(['native-module'])
          .mockResolvedValueOnce([]) as CliPrompts['multiselect'],
      },
    });

    await expect(main(['--dir', dir], runtime)).rejects.toThrow(
      /At least one Native platform is required/,
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
    const binPath = path.join('node_modules', '.bin', 'create-lynx-library');
    const cliPath = path.join(
      'node_modules',
      'create-lynx-library',
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
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-library-cli-'));
  tempDirs.push(parent);
  return path.join(parent, name);
}

function read(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

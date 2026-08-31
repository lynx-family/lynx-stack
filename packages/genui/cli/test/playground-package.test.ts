// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as childProcess from 'node:child_process';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));

describe('published playground assets', () => {
  test('the local surface reuses only the hosted shared-ui barrel', () => {
    const browserRoot = path.join(
      packageRoot,
      'cli',
      'src',
      'playground',
      'browser',
    );
    expect(fs.existsSync(path.join(browserRoot, 'app.ts'))).toBe(false);
    expect(fs.existsSync(path.join(browserRoot, 'style.css'))).toBe(false);

    const localSources = [
      'LocalAgentChatController.tsx',
      'LocalPlaygroundApp.tsx',
    ].map((file) => fs.readFileSync(path.join(browserRoot, file), 'utf8'));
    const hostedSourceImports = localSources.flatMap((source) =>
      [...source.matchAll(/from ['"]([^'"]*playground\/src\/[^'"]+)['"]/gu)]
        .map((match) => match[1])
    );
    expect(hostedSourceImports.length).toBeGreaterThan(0);
    expect(new Set(hostedSourceImports)).toEqual(
      new Set(['../../../../playground/src/shared-ui/index.js']),
    );
    const localSource = localSources.join('\n');
    for (
      const forbidden of [
        'useConversation',
        'conversationRepo',
        'GENUI_SERVER_URL',
        '/lynx-xml/stream',
        'indexedDB',
      ]
    ) {
      expect(localSource).not.toContain(forbidden);
    }

    const sharedBarrel = fs.readFileSync(
      path.join(packageRoot, 'playground', 'src', 'shared-ui', 'index.ts'),
      'utf8',
    );
    for (
      const forbidden of [
        'ChatController',
        'useConversation',
        'conversationRepo',
        'HostedPreviewViewport',
        'components/PreviewPanel.js',
      ]
    ) {
      expect(sharedBarrel).not.toContain(forbidden);
    }

    const hostedRoot = path.join(packageRoot, 'playground', 'src');
    const sharedOwners = [
      {
        barrel:
          'export { PlaygroundChrome } from \'../components/PlaygroundChrome.js\'',
        hostedFile: 'App.tsx',
        hostedImport: 'from \'./components/PlaygroundChrome.js\'',
      },
      {
        barrel:
          'export { ChatWorkspace } from \'../pages/chat/ChatWorkspace.js\'',
        hostedFile: 'pages/chat/ChatController.tsx',
        hostedImport: 'from \'./ChatWorkspace.js\'',
      },
      {
        barrel: 'export { DemosList } from \'../pages/demos/DemosList.js\'',
        hostedFile: 'pages/demos/DemosListPage.tsx',
        hostedImport: 'from \'./DemosList.js\'',
      },
      {
        barrel: 'export { DemosPage } from \'../pages/demos/DemosPage.js\'',
        hostedFile: 'pages/demos/ProtocolDemosPage.tsx',
        hostedImport: 'from \'./DemosPage.js\'',
      },
    ];
    for (const owner of sharedOwners) {
      expect(sharedBarrel).toContain(owner.barrel);
      expect(
        fs.readFileSync(path.join(hostedRoot, owner.hostedFile), 'utf8'),
      ).toContain(owner.hostedImport);
    }
    expect(sharedBarrel).toContain('import \'../styles.css\'');
  });

  test('passes packaged fake protocol UI conformance', () => {
    const output = childProcess.execFileSync(
      process.execPath,
      [
        path.join(
          packageRoot,
          'cli',
          'scripts',
          'playground-ui-conformance.mjs',
        ),
      ],
      { cwd: path.join(packageRoot, 'cli'), encoding: 'utf8' },
    );
    expect(JSON.parse(output)).toEqual({
      transport: 'packaged-fake-protocol-daemon-http-sse-control-ui-playwright',
      cancellation: true,
      allowOnce: true,
      deny: true,
      uniqueTerminal: true,
      noLateArtifact: true,
      noOrphanProcesses: true,
      admissionRetry: true,
      awaitingApprovalCancellation: true,
      approvalActor: 'playwright-user-click',
      sharedUiParity: true,
      visualSmoke: true,
    });
  }, 120_000);

  test('the public package includes standalone local control and preview runtime assets', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
    ) as { files: string[] };
    expect(manifest.files).toContain('cli/dist');
    const assetRoot = path.join(
      packageRoot,
      'cli',
      'dist',
      'playground',
      'public',
    );
    expect(fs.existsSync(path.join(assetRoot, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(assetRoot, 'preview.html'))).toBe(true);
    const files = walk(assetRoot);
    expect(files.some((file) => file.endsWith('.wasm'))).toBe(true);
    const textAssets = files.filter((file) => /\.(?:html|js|css)$/u.test(file))
      .map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    expect(textAssets).not.toContain('packages/genui/playground');
    expect(textAssets).not.toContain('GENUI_SERVER_URL');
    expect(textAssets).not.toContain('/lynx-xml/stream');

    const controlHtml = fs.readFileSync(
      path.join(assetRoot, 'index.html'),
      'utf8',
    );
    const previewHtml = fs.readFileSync(
      path.join(assetRoot, 'preview.html'),
      'utf8',
    );
    expect(controlHtml).toMatch(/static\/js\/index\.[0-9a-f]+\.js/u);
    expect(controlHtml).not.toMatch(/static\/js\/preview\./u);
    expect(previewHtml).toMatch(/static\/js\/preview\.[0-9a-f]+\.js/u);
    expect(previewHtml).not.toMatch(/static\/js\/index\./u);

    const controlScript = fs.readFileSync(
      files.find((file) => /\/static\/js\/index\.[0-9a-f]+\.js$/u.test(file))!,
      'utf8',
    );
    for (
      const forbidden of [
        'GENUI_SERVER_URL',
        '/lynx-xml/stream',
        'conversationRepo',
        'indexedDB',
        '__rspeedy_url',
        '__openui_payload',
      ]
    ) {
      expect(controlScript).not.toContain(forbidden);
    }
  });

  test('the actual tarball contains the executable daemon and all static assets', () => {
    const temporary = rootTemporaryDirectory();
    const output = childProcess.execFileSync(
      'pnpm',
      ['pack', '--pack-destination', temporary, '--json'],
      { cwd: packageRoot, encoding: 'utf8' },
    );
    const result = JSON.parse(output) as {
      filename: string;
      files: Array<{ path: string }>;
    };
    const paths = result.files.map((file) => file.path);
    expect(paths).toContain('cli/dist/playground/index.js');
    expect(paths).toContain('cli/dist/playground/public/index.html');
    expect(paths).toContain('cli/dist/playground/public/preview.html');
    expect(
      paths.some((file) =>
        file.startsWith('cli/dist/playground/public/static/js/')
      ),
    ).toBe(true);
    expect(
      paths.some((file) =>
        file.startsWith('cli/dist/playground/public/static/wasm/')
      ),
    ).toBe(true);
    fs.rmSync(result.filename, { force: true });
    fs.rmSync(temporary, { recursive: true, force: true });
  });

  test('runs the packed CLI from a clean extracted directory', async () => {
    const temporary = rootTemporaryDirectory();
    const output = childProcess.execFileSync(
      'pnpm',
      ['pack', '--pack-destination', temporary, '--json'],
      { cwd: packageRoot, encoding: 'utf8' },
    );
    const result = JSON.parse(output) as { filename: string };
    const extracted = path.join(temporary, 'extracted');
    fs.mkdirSync(extracted);
    childProcess.execFileSync('tar', [
      '-xzf',
      result.filename,
      '-C',
      extracted,
    ]);
    const port = 62_000 + Math.floor(Math.random() * 2_000);
    const dataRoot = path.join(temporary, 'data');
    const child = spawn(
      process.execPath,
      [
        path.join(extracted, 'package', 'cli', 'bin', 'cli.js'),
        'playground',
        '--no-open',
        '--port',
        String(port),
        '--data-dir',
        dataRoot,
      ],
      {
        cwd: extracted,
        env: { ...process.env, NO_PROXY: '*' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    try {
      const stdout = await waitForOutput(child, '#bootstrap=');
      expect(stdout).toContain(`http://127.0.0.1:${port}/#bootstrap=`);
      const control = await fetch(`http://127.0.0.1:${port}/`);
      expect(control.status).toBe(200);
    } finally {
      child.kill('SIGINT');
      await new Promise((resolve) => child.once('close', resolve));
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  }, 30_000);
});

function walk(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function rootTemporaryDirectory(): string {
  return fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), 'genui-pack-'),
  );
}

function waitForOutput(
  child: ReturnType<typeof spawn>,
  expected: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Timed out waiting for packed CLI: ${stderr}`));
    }, 10_000);
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
      if (stdout.includes(expected)) {
        clearTimeout(timeout);
        resolve(stdout);
      }
    });
    child.stderr?.on(
      'data',
      (chunk: Buffer) => stderr += chunk.toString('utf8'),
    );
    child.once('error', reject);
    child.once('close', (code) => {
      if (!stdout.includes(expected)) {
        clearTimeout(timeout);
        reject(new Error(`Packed CLI exited ${code}: ${stderr}`));
      }
    });
  });
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict';
import { access, writeFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import path from 'node:path';

import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    assert(!specifier.startsWith('@lynx-js/react'));
    assert(!specifier.startsWith('@lynx-js/lynx-ui'));
    return next(specifier, context);
  },
  load(url, context, next) {
    assert(!/\.(?:jsx|css)$/u.test(url));
    return next(url, context);
  },
});

const imports = [];
for (
  const prefix of ['@lynx-js/genui/openui/chat', '@lynx-js/genui-openui/chat']
) {
  const { createOpenUiChatPromptLibrary } = await import(`${prefix}/agent`);
  const { components } = createOpenUiChatPromptLibrary();
  for (const [name, definition] of Object.entries(components)) {
    const renderer = `${prefix}/${name}`;
    const agent = `${prefix}/agent/${name}`;
    assert.equal((await import(agent))[name], definition);
    await access(new URL(import.meta.resolve(renderer)));
    // TypeScript must resolve the published declaration for both public paths.
    for (const entry of [renderer, agent]) {
      const binding = `Component${imports.length}`;
      imports.push(
        `import { ${name} as ${binding} } from '${entry}';\n${binding}.props;`,
      );
    }
  }
}
const file = path.resolve('check.mts');
await writeFile(file, imports.join('\n'));
const program = ts.createProgram([file], {
  noEmit: true,
  strict: true,
  skipLibCheck: true,
  module: ts.ModuleKind.NodeNext,
  target: ts.ScriptTarget.ESNext,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(
  diagnostics.length,
  0,
  ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => process.cwd(),
    getCanonicalFileName: name => name,
    getNewLine: () => '\n',
  }),
);
console.log('Chat subpaths and declarations verified');

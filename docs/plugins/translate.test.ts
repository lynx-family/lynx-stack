// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test } from 'vitest';

import { Translations } from './translate.ts';

test('cleanup removes unused entries without modifying inherited dictionaries', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-translations-'));
  try {
    const base = join(dir, 'base.json');
    const local = join(dir, 'local.json');
    const inherited = JSON.stringify({ 'Base text': '基础文本' });
    writeFileSync(base, inherited);
    writeFileSync(
      local,
      JSON.stringify({
        'Base text': '基础文本',
        'Used text': '使用文本',
        'Unused text': '冗余文本',
      }),
    );
    const translations = new Translations([base, local]);
    translations.translate('Base text\n\nUsed text\n\nMissing text', 'en');
    translations.save();
    assert.equal(
      (JSON.parse(readFileSync(local, 'utf8')) as Record<string, string>)[
        'Unused text'
      ],
      '冗余文本',
    );
    translations.save(true);
    assert.deepEqual(JSON.parse(readFileSync(local, 'utf8')), {
      'Missing text': '',
      'Used text': '使用文本',
    });
    assert.equal(readFileSync(base, 'utf8'), inherited);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

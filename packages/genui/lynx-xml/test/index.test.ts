// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  normalizeLynxXmlOutput,
  parseLynxXml,
  validateLynxXml,
} from '../src/index.js';

const VALID_ARTIFACT = `<!DOCTYPE lynx>
<style>
  .page { display: flex; }
</style>
<script main-thread>
  globalThis.renderPage = function renderPage() {
    const page = __CreatePage('main', 0);
    const pageId = __GetElementUniqueID(page);
    const content = __CreateView(pageId);
    __AppendElement(page, content);
  };
</script>`;

describe('Lynx XML protocol', () => {
  test('parses required and optional sections', () => {
    const sections = parseLynxXml(`${VALID_ARTIFACT}\n<script background>
      const mainThread = lynx.getCoreContext();
    </script>`);
    expect(sections.style).toContain('.page');
    expect(sections.mainThread).toContain('globalThis.renderPage');
    expect(sections.background).toContain('lynx.getCoreContext()');
  });

  test('normalizes a fenced model response', () => {
    expect(normalizeLynxXmlOutput(`\`\`\`xml\n${VALID_ARTIFACT}\n\`\`\``))
      .toBe(VALID_ARTIFACT);
  });

  test('validates Element PAPI output', () => {
    expect(validateLynxXml(VALID_ARTIFACT)).toMatchObject({ ok: true });
    const invalid = validateLynxXml(`<!DOCTYPE lynx>
      <style></style>
      <script main-thread>document.body.textContent = 'no';</script>`);
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.errors.some((error) => error.includes('__CreatePage')))
      .toBe(true);
    expect(invalid.errors.some((error) => error.includes('browser DOM')))
      .toBe(true);
  });

  test('does not mistake JavaScript comparisons for JSX', () => {
    const artifact = VALID_ARTIFACT.replace(
      'const content = __CreateView(pageId);',
      `const content = __CreateView(pageId);
    const items = [1, 2, 3];
    for (let index = 0; index < items.length; index += 1) {
      if (items[index] > 0) __SetDataset(content, { index });
    }
    const helpText = "<view> is not rendered as JSX";
    // <text> inside a comment is not JSX either.
    void helpText;`,
    );

    expect(validateLynxXml(artifact)).toMatchObject({ ok: true });
  });

  test('rejects actual JSX mixed into an Element PAPI script', () => {
    const artifact = VALID_ARTIFACT.replace(
      'const content = __CreateView(pageId);',
      `const content = __CreateView(pageId);
    const invalidNode = <view className="content" />;
    void invalidNode;`,
    );
    const result = validateLynxXml(artifact);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'main-thread script must use Element PAPI instead of React/JSX',
    );
  });
});

// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import stylelint from 'stylelint';
import { describe, expect, it } from 'vitest';

import plugin from '../src/index.js';

function lint(
  code: string,
  ruleValue: true | false | [
    true,
    import('../src/rules/no-unsupported-properties.js').RuleOptions,
  ] = true,
) {
  return stylelint.lint({
    code,
    config: {
      plugins: [plugin],
      rules: {
        'lynx/no-unsupported-properties': ruleValue,
      },
    },
  });
}

function getWarningTexts(result: stylelint.LinterResult) {
  return result.results[0]?.warnings.map((w) => w.text) ?? [];
}

describe('lynx/no-unsupported-properties', () => {
  it('warns on unsupported properties', async () => {
    const css = '.a { backdrop-filter: blur(2px); color: red; --foo: 1; }';

    const result = await lint(css);
    const texts = getWarningTexts(result);

    expect(texts.some((t) => t.includes('Unsupported CSS property'))).toBe(
      true,
    );
  });

  it('does not warn on supported properties', async () => {
    const css =
      '.a { color: red; width: 10px; height: 20px; margin: 0; padding: 0; }';

    const result = await lint(css);
    const texts = getWarningTexts(result);

    expect(texts).toHaveLength(0);
  });

  it('does not warn when the rule is disabled', async () => {
    const css = '.a { backdrop-filter: blur(2px); }';

    const result = await lint(css, false);
    const texts = getWarningTexts(result);

    expect(texts).toHaveLength(0);
  });

  it('does not warn on custom properties', async () => {
    const css = '.a { --foo: 1; --bar-baz: red; color: var(--bar-baz); }';

    const result = await lint(css);
    const texts = getWarningTexts(result);

    expect(texts).toHaveLength(0);
  });

  it('supports option: allow (treat as supported)', async () => {
    const css = '.a { backdrop-filter: blur(2px); }';

    const result = await lint(css, [true, { allow: ['backdrop-filter'] }]);
    const texts = getWarningTexts(result);

    expect(texts).toHaveLength(0);
  });

  it('supports option: ignore (remove from supported list)', async () => {
    const css = '.a { color: red; }';

    const result = await lint(css, [true, { ignore: ['color'] }]);
    const texts = getWarningTexts(result).filter((t) =>
      t.includes('Unsupported CSS property')
    );

    expect(texts.length).toBeGreaterThanOrEqual(1);
  });

  it('supports option precedence: ignore overrides allow', async () => {
    const css = '.a { backdrop-filter: blur(2px); }';

    const result = await lint(css, [
      true,
      { allow: ['backdrop-filter'], ignore: ['backdrop-filter'] },
    ]);
    const texts = getWarningTexts(result).filter((t) =>
      t.includes('Unsupported CSS property')
    );

    expect(texts.length).toBeGreaterThanOrEqual(1);
  });

  it('warns on unsupported properties inside @media', async () => {
    const css =
      '@media (min-width: 320px) { .a { backdrop-filter: blur(2px); } }';

    const result = await lint(css);
    const texts = getWarningTexts(result);

    expect(texts.some((t) => t.includes('Unsupported CSS property'))).toBe(
      true,
    );
  });

  it('warns on at least one unsupported property when multiple exist', async () => {
    const css = '.a { backdrop-filter: blur(2px); clip-path: circle(50%); }';

    const result = await lint(css);
    const texts = getWarningTexts(result).filter((t) =>
      t.includes('Unsupported CSS property')
    );

    expect(texts.length).toBeGreaterThanOrEqual(1);
  });
});

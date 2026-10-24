// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import {
  applyLynxXmlStylePreset,
  buildLynxXmlSystemPrompt,
  compileLynxXmlFragment,
  generateMainThreadScriptResult,
} from '../src/index.js';

function document(fragment: string, extra = '', style = '') {
  return `<!doctype lynx><lynx engine-version="4.2">${style}<template>${fragment}</template><script thread="main">createFragment(page, pageId);${extra}</script></lynx>`;
}

test('leaves preset styling disabled by default and preserves custom styles', () => {
  const source = document(
    '<view class="flex p-4"/>',
    '',
    '<style>.p-4 { padding: 19px; }</style>',
  );
  const original = compileLynxXmlFragment(source);
  expect(compileLynxXmlFragment(source, { stylePreset: false })).toEqual(
    original,
  );
  expect(original.text).not.toContain('padding: 16px');
  expect(original.text.match(/<style>/gu)).toHaveLength(1);
});

test('generates literal Lynx utility CSS before author styles and retains XML evidence', () => {
  const fragment =
    '<view class="flex flex-col p-4 px-6 rounded-xl bg-blue-500 custom"><text class="text-lg font-bold">bg-red-500</text></view>';
  const customCss = '.custom { padding: 22px; }';
  const style = `<style>${customCss}</style>`;
  const compiled = compileLynxXmlFragment(document(fragment, '', style), {
    stylePreset: 'default',
  });
  expect(compiled.xmlFragment).toBe(fragment);
  expect(compiled.text.match(/<style>/gu)).toHaveLength(1);
  expect(compiled.text.match(/<\/style>/gu)).toHaveLength(1);
  expect(compiled.text).toContain('.flex { display: flex; }');
  expect(compiled.text).toContain('.flex-col { flex-direction: column; }');
  expect(compiled.text).toContain('.p-4 { padding: 16px; }');
  expect(compiled.text).toContain(
    '.px-6 { padding-left: 24px; padding-right: 24px; }',
  );
  expect(compiled.text).toContain('.rounded-xl { border-radius: 12px; }');
  expect(compiled.text).toContain(
    '.bg-blue-500 { background-color: #3b82f6; }',
  );
  expect(compiled.text).toContain('.text-lg { font-size: 18px; }');
  expect(compiled.text).toContain('.font-bold { font-weight: 700; }');
  expect(compiled.text.indexOf('.p-4 {')).toBeLessThan(
    compiled.text.indexOf('.px-6 {'),
  );
  expect(compiled.text.indexOf('.px-6 {')).toBeLessThan(
    compiled.text.indexOf(customCss),
  );
  expect(compiled.text).not.toContain('.bg-red-500 {');
  expect(compiled.text).not.toContain('var(--');
  expect(compiled.text).not.toContain('@import');
  expect(compiled.text).not.toContain('<template>');
});

test.each(['before-template', 'after-script'])(
  'merges preset CSS into an existing empty style block %s',
  position => {
    const source = position === 'before-template'
      ? document('<view class="p-4"/>', '', '<style></style>')
      : document('<view class="p-4"/>').replace(
        '</lynx>',
        '<style></style></lynx>',
      );
    const compiled = compileLynxXmlFragment(source, {
      stylePreset: 'default',
    });
    expect(compiled.text.match(/<style>/gu)).toHaveLength(1);
    expect(compiled.text).toContain('<style>.p-4 { padding: 16px; }\n</style>');
  },
);

test.each([false, 'default'] as const)(
  'merges multiple authored style blocks in source order (preset=%s)',
  stylePreset => {
    const first = '.p-4 { padding: 20px; }';
    const last = '.p-4 { padding: 24px; }';
    const source = document(
      '<view class="p-4"/>',
      '',
      `<style>${first}</style>`,
    )
      .replace('</lynx>', `<style>${last}</style></lynx>`);
    const compiled = compileLynxXmlFragment(source, { stylePreset });
    expect(compiled.text.match(/<style>/gu)).toHaveLength(1);
    expect(compiled.text.match(/<\/style>/gu)).toHaveLength(1);
    expect(compiled.text).toContain(
      `<style>${
        stylePreset ? '.p-4 { padding: 16px; }\n' : ''
      }${first}\n${last}</style>`,
    );
    expect(compiled.text).toContain('createFragment(page, pageId);');
    expect(compiled.text).not.toContain('<template>');
  },
);

test('collects decoded template classes and literal dynamic states without executing code', () => {
  const result = generateMainThreadScriptResult(
    '<view class="flex flex-col custom&amp;name flex"/>',
  );
  expect(result.classNames).toEqual(['flex', 'flex-col', 'custom&name']);
  const source = document(
    '<view class="flex"/>',
    `
    const states = ["bg-red-500", "bg-green-500"];
    const classes = \`text-white font-bold\`;
    throw new Error("must not execute");
  `,
  );
  const compiled = compileLynxXmlFragment(source, { stylePreset: 'default' });
  expect(compiled.text.match(/<style>/gu)).toHaveLength(1);
  for (
    const name of [
      'flex',
      'bg-red-500',
      'bg-green-500',
      'text-white',
      'font-bold',
    ]
  ) {
    expect(compiled.text).toContain(`.${name} {`);
  }
  expect(compiled.text).toContain('throw new Error');
});

function compileClasses(classes: string) {
  return compileLynxXmlFragment(
    document(`<view class="${classes}"/><view class="p-4"/>`),
    { stylePreset: 'default' },
  ).text.split('</style>')[0];
}

test('uses a stable stylesheet order and deduplicates utilities', () => {
  expect(compileClasses('p-4 px-2 pt-1 flex')).toBe(
    compileClasses('flex pt-1 px-2 p-4 p-4'),
  );
  expect(compileClasses('p-4 p-4')?.match(/\.p-4 \{/gu)).toHaveLength(1);
});

test('covers sizing, typography, borders, and alpha without browser-only CSS', () => {
  const compiled = compileLynxXmlFragment(
    document(
      '<view class="w-full min-w-4 max-w-full min-h-screen h-12 shrink-0 gap-y-2 border-2 border-slate-200 opacity-50"><text class="leading-6 text-center whitespace-normal"/></view>',
    ),
    { stylePreset: 'default' },
  );
  for (
    const declaration of [
      'width: 100%;',
      'min-width: 16px;',
      'max-width: 100%;',
      'min-height: 100vh;',
      'height: 48px;',
      'flex-shrink: 0;',
      'row-gap: 8px;',
      'border-width: 2px; border-style: solid;',
      'border-color: #e2e8f0;',
      'opacity: 0.5;',
      'line-height: 24px;',
      'text-align: center;',
      'white-space: normal;',
    ]
  ) {
    expect(compiled.text).toContain(declaration);
  }
});

test('keeps custom classes and unsupported utility syntax available to author CSS', () => {
  const source = document('<view class="custom sm:flex bg-[red]"/>');
  expect(compileLynxXmlFragment(source, { stylePreset: 'default' })).toEqual(
    compileLynxXmlFragment(source),
  );
  expect(() =>
    compileLynxXmlFragment(source, {
      // @ts-expect-error Invalid presets must also fail at runtime.
      stylePreset: 'unknown',
    })
  ).toThrow('Unsupported Lynx XML style preset');
});

test('applies preset styles to direct Element PAPI without rewriting or executing scripts', () => {
  const script = `const page = __CreatePage("0", 0);
__SetClasses(page, "flex flex-col p-4");
const states = ["bg-red-500", "bg-green-500"];
const literal = "<template><view/></template>";
throw new Error("must not execute");`;
  const background =
    '<script thread="background">console.log("background");</script>';
  const source =
    `<!doctype lynx><lynx engine-version="4.2"><style>.p-4 { padding: 20px; }</style><script thread="main">${script}</script>${background}<style>.custom { opacity: 0.5; }</style></lynx>`;
  const result = applyLynxXmlStylePreset(source);
  expect(result.match(/<style>/gu)).toHaveLength(1);
  expect(result).toContain('.p-4 { padding: 16px; }');
  expect(result).toContain('.bg-red-500 {');
  expect(result).toContain('.bg-green-500 {');
  expect(result.indexOf('.p-4 { padding: 16px; }')).toBeLessThan(
    result.indexOf('.p-4 { padding: 20px; }'),
  );
  expect(result).toContain(`<script thread="main">${script}</script>`);
  expect(result).toContain(background);
  expect(result).not.toContain('function createFragment');
  expect(() => applyLynxXmlStylePreset(document('<view/>'))).toThrow(
    'Enable Template',
  );
});

test('injects a single style section when a direct document has none', () => {
  const source =
    '<!doctype lynx><lynx engine-version="4.2"><script thread="main">__SetClasses(page, `flex p-4`);</script></lynx>';
  const result = applyLynxXmlStylePreset(source);
  expect(result.match(/<style>/gu)).toHaveLength(1);
  expect(result).toContain('.flex { display: flex; }');
  expect(result).toContain('.p-4 { padding: 16px; }');
});

test('selects preset prompt guidance independently of Template', () => {
  const original = buildLynxXmlSystemPrompt({ enableHtmlFragment: true });
  expect(
    buildLynxXmlSystemPrompt({ enableHtmlFragment: true, stylePreset: false }),
  ).toBe(original);
  expect(original).not.toContain('Lynx StylePreset');
  const enabled = buildLynxXmlSystemPrompt({
    enableHtmlFragment: true,
    stylePreset: 'default',
  });
  expect(enabled).toContain('Lynx StylePreset "default" is enabled');
  expect(enabled).toContain('one step is 4px');
  expect(enabled).not.toContain('Write all CSS,');
  const direct = buildLynxXmlSystemPrompt({ stylePreset: 'default' });
  expect(direct).toContain('Lynx StylePreset "default" is enabled');
  expect(direct).not.toContain('Template mode is enabled');
  expect(direct).not.toContain('server supplies createFragment');
});

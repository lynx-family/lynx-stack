// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Built-in StylePreset names for Lynx utility styles. */
export type LynxXmlStylePreset = 'default';

const SPACING = [
  0,
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  14,
  16,
  20,
  24,
  28,
  32,
  36,
  40,
  48,
  56,
  64,
  72,
  80,
  96,
];
const COLORS: Record<string, readonly string[]> = {
  slate: [
    '#f8fafc',
    '#f1f5f9',
    '#e2e8f0',
    '#cbd5e1',
    '#94a3b8',
    '#64748b',
    '#475569',
    '#334155',
    '#1e293b',
    '#0f172a',
  ],
  gray: [
    '#f9fafb',
    '#f3f4f6',
    '#e5e7eb',
    '#d1d5db',
    '#9ca3af',
    '#6b7280',
    '#4b5563',
    '#374151',
    '#1f2937',
    '#111827',
  ],
  red: [
    '#fef2f2',
    '#fee2e2',
    '#fecaca',
    '#fca5a5',
    '#f87171',
    '#ef4444',
    '#dc2626',
    '#b91c1c',
    '#991b1b',
    '#7f1d1d',
  ],
  amber: [
    '#fffbeb',
    '#fef3c7',
    '#fde68a',
    '#fcd34d',
    '#fbbf24',
    '#f59e0b',
    '#d97706',
    '#b45309',
    '#92400e',
    '#78350f',
  ],
  green: [
    '#f0fdf4',
    '#dcfce7',
    '#bbf7d0',
    '#86efac',
    '#4ade80',
    '#22c55e',
    '#16a34a',
    '#15803d',
    '#166534',
    '#14532d',
  ],
  blue: [
    '#eff6ff',
    '#dbeafe',
    '#bfdbfe',
    '#93c5fd',
    '#60a5fa',
    '#3b82f6',
    '#2563eb',
    '#1d4ed8',
    '#1e40af',
    '#1e3a8a',
  ],
  indigo: [
    '#eef2ff',
    '#e0e7ff',
    '#c7d2fe',
    '#a5b4fc',
    '#818cf8',
    '#6366f1',
    '#4f46e5',
    '#4338ca',
    '#3730a3',
    '#312e81',
  ],
  rose: [
    '#fff1f2',
    '#ffe4e6',
    '#fecdd3',
    '#fda4af',
    '#fb7185',
    '#f43f5e',
    '#e11d48',
    '#be123c',
    '#9f1239',
    '#881337',
  ],
};

// Registry order defines the cascade, independent of the order of XML nodes/classes.
// Broad spacing rules precede axis rules, which precede individual edges.
const RULES = new Map<string, string>();
function add(name: string, declarations: string): void {
  RULES.set(name, declarations);
}
function values(
  prefix: string,
  property: string,
  entries: Record<string, string>,
): void {
  for (const [name, value] of Object.entries(entries)) {
    add(`${prefix}-${name}`, `${property}: ${value};`);
  }
}

add('flex', 'display: flex;');
add('hidden', 'display: none;');
values('flex', 'flex-direction', {
  row: 'row',
  col: 'column',
  'row-reverse': 'row-reverse',
  'col-reverse': 'column-reverse',
});
values('flex', 'flex-wrap', { wrap: 'wrap', nowrap: 'nowrap' });
values('flex', 'flex', { '1': '1', auto: '1 1 auto', none: 'none' });
values('grow', 'flex-grow', { '0': '0' });
add('grow', 'flex-grow: 1;');
values('shrink', 'flex-shrink', { '0': '0' });
add('shrink', 'flex-shrink: 1;');
values('items', 'align-items', {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  stretch: 'stretch',
  baseline: 'baseline',
});
values('justify', 'justify-content', {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
});
values('self', 'align-self', {
  auto: 'auto',
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  stretch: 'stretch',
});

for (
  const [prefix, properties] of Object.entries({
    p: ['padding'],
    px: ['padding-left', 'padding-right'],
    py: ['padding-top', 'padding-bottom'],
    pt: ['padding-top'],
    pr: ['padding-right'],
    pb: ['padding-bottom'],
    pl: ['padding-left'],
    m: ['margin'],
    mx: ['margin-left', 'margin-right'],
    my: ['margin-top', 'margin-bottom'],
    mt: ['margin-top'],
    mr: ['margin-right'],
    mb: ['margin-bottom'],
    ml: ['margin-left'],
    gap: ['gap'],
    'gap-x': ['column-gap'],
    'gap-y': ['row-gap'],
    w: ['width'],
    h: ['height'],
    'min-w': ['min-width'],
    'min-h': ['min-height'],
    'max-w': ['max-width'],
    'max-h': ['max-height'],
  })
) {
  for (const step of SPACING) {
    add(
      `${prefix}-${step}`,
      properties.map(property => `${property}: ${step * 4}px;`).join(' '),
    );
  }
}
for (const prefix of ['w', 'min-w', 'max-w', 'h', 'min-h', 'max-h']) {
  const axis = prefix.endsWith('w') ? 'width' : 'height';
  const resolved = prefix.includes('-')
    ? `${prefix.split('-')[0]}-${axis}`
    : axis;
  add(`${prefix}-full`, `${resolved}: 100%;`);
}
add('w-screen', 'width: 100vw;');
add('h-screen', 'height: 100vh;');
add('min-h-screen', 'min-height: 100vh;');
values('text', 'font-size', {
  xs: '12px',
  sm: '14px',
  base: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
  '5xl': '48px',
  '6xl': '60px',
});
values('font', 'font-weight', {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
});
values('text', 'text-align', {
  left: 'left',
  center: 'center',
  right: 'right',
});
values('whitespace', 'white-space', { normal: 'normal', nowrap: 'nowrap' });
for (const step of [3, 4, 5, 6, 7, 8, 9, 10, 12]) {
  add(`leading-${step}`, `line-height: ${step * 4}px;`);
}
add('rounded', 'border-radius: 4px;');
values('rounded', 'border-radius', {
  none: '0px',
  sm: '2px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px',
});
add('border', 'border-width: 1px; border-style: solid;');
for (const width of [0, 2, 4, 8]) {
  add(`border-${width}`, `border-width: ${width}px; border-style: solid;`);
}
for (
  const [prefix, property] of Object.entries({
    bg: 'background-color',
    text: 'color',
    border: 'border-color',
  })
) {
  values(prefix, property, {
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  });
  for (const [palette, shades] of Object.entries(COLORS)) {
    shades.forEach((color, index) =>
      add(
        `${prefix}-${palette}-${index === 0 ? 50 : index * 100}`,
        `${property}: ${color};`,
      )
    );
  }
}
for (const opacity of [0, 25, 50, 75, 100]) {
  add(`opacity-${opacity}`, `opacity: ${opacity / 100};`);
}
values('overflow', 'overflow', { hidden: 'hidden', visible: 'visible' });

/** Validate the explicitly selected preset; omission and false keep CSS untouched. */
export function validateStylePreset(
  preset: LynxXmlStylePreset | false | undefined,
): void {
  if (preset !== undefined && preset !== false && preset !== 'default') {
    throw new TypeError(`Unsupported Lynx XML style preset: ${String(preset)}`);
  }
}

/** Emit only registered utilities, in stable cascade order. Custom classes are ignored. */
export function generatePresetStyles(classNames: ReadonlySet<string>): string {
  return [...RULES].filter(([name]) => classNames.has(name))
    .map(([name, declarations]) => `.${name} { ${declarations} }`).join('\n');
}

/** Compact model-facing vocabulary for the built-in Lynx style preset. */
export const LYNX_XML_STYLE_PRESET_INSTRUCTIONS: string =
  `Lynx StylePreset "default" is enabled:
- Reuse the following classes instead of writing their CSS. The converter combines used preset rules followed by your custom CSS in a single <style> block; same-specificity custom CSS can override them. Write only additional styles not covered by this preset.
- This is a fixed Lynx utility vocabulary with literal px/hex values. It has no automatic reset, CSS variables, arbitrary values, fractions, variants (sm:, hover:, dark:), or @apply. Use custom CSS for unsupported styling. Avoid conflicting utilities for the same property.
- Layout: flex with flex-row or flex-col (also row-reverse/col-reverse), flex-wrap/nowrap, flex-1/auto/none, grow, grow-0, shrink, shrink-0, items-start/end/center/stretch/baseline, justify-start/end/center/between/around/evenly, self-auto/start/end/center/stretch, hidden.
- Spacing and sizes: p/px/py/pt/pr/pb/pl, m/mx/my/mt/mr/mb/ml, gap/gap-x/gap-y, w/h/min-w/min-h/max-w/max-h followed by -N. N is one of ${
    SPACING.join(', ')
  }; one step is 4px, e.g. p-4 = 16px. Sizes also support -full; w-screen = 100vw; h-screen and min-h-screen = 100vh.
- Text: text-xs/sm/base/lg/xl/2xl/3xl/4xl/5xl/6xl = 12/14/16/18/20/24/30/36/48/60px. font-normal/medium/semibold/bold/extrabold; text-left/center/right; whitespace-normal/nowrap; leading-3/4/5/6/7/8/9/10/12 uses 4px steps. Apply text styles to <text> nodes.
- Shape: rounded (4px), rounded-none/sm/md/lg/xl/2xl/3xl/full = 0/2/6/8/12/16/24/9999px; border (1px solid), border-0/2/4/8; opacity-0/25/50/75/100; overflow-hidden/visible.
- Colors: bg/text/border-white/black/transparent, or bg/text/border-COLOR-SHADE. COLOR: ${
    Object.keys(COLORS).join(', ')
  }. SHADE: 50, 100, 200, 300, 400, 500, 600, 700, 800, 900.
- Use complete class names in template class attributes and JavaScript string literals, including all possible dynamic states. Do not construct utility names by concatenating fragments.`;

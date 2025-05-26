// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { parseFlexShorthand } from './parseFlexShorthand.js';
/**
 * replace values of the property
 * if one value is not listed, it will be ignored and kept as is.
 */
const replaceRules: {
  [declarationPropertyName: string]: {
    [plainValue: string]:
      | [newDeclarationPropertyName: string, newValue: string][]
      | undefined;
  };
} = {
  display: {
    linear: [
      ['--lynx-display-toggle', 'var(--lynx-display-linear)'],
      ['--lynx-display', 'linear'],
      ['display', 'flex'],
    ],
    flex: [
      ['--lynx-display-toggle', 'var(--lynx-display-flex)'],
      ['--lynx-display', 'flex'],
      ['display', 'flex'],
    ],
  },
  direction: {
    'lynx-rtl': [['direction', 'rtl']],
  },
  'linear-orientation': {
    none: [],
    horizontal: [
      ['--lynx-linear-orientation', 'horizontal'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-horizontal)',
      ],
    ],
    'horizontal-reverse': [
      ['--lynx-linear-orientation', 'horizontal-reverse'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-horizontal-reverse)',
      ],
    ],
    vertical: [
      ['--lynx-linear-orientation', 'vertical'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-vertical)',
      ],
    ],
    'vertical-reverse': [
      ['--lynx-linear-orientation', 'vertical-reverse'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-vertical-reverse)',
      ],
    ],
  },
  'linear-direction': {
    none: [],
    row: [
      ['--lynx-linear-orientation', 'horizontal'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-horizontal)',
      ],
    ],
    'row-reverse': [
      ['--lynx-linear-orientation', 'horizontal-reverse'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-horizontal-reverse)',
      ],
    ],
    column: [
      ['--lynx-linear-orientation', 'vertical'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-vertical)',
      ],
    ],
    'column-reverse': [
      ['--lynx-linear-orientation', 'vertical-reverse'],
      [
        '--lynx-linear-orientation-toggle',
        'var(--lynx-linear-orientation-vertical-reverse)',
      ],
    ],
  },
  'linear-gravity': {
    none: [],
    top: [
      ['--justify-content-column', 'flex-start'],
      ['--justify-content-column-reverse', 'flex-end'],
      ['--justify-content-row', 'flex-start'],
      ['--justify-content-row-reverse', 'flex-start'],
    ],
    bottom: [
      ['--justify-content-column', 'flex-end'],
      ['--justify-content-column-reverse', 'flex-start'],
      ['--justify-content-row', 'flex-start'],
      ['--justify-content-row-reverse', 'flex-start'],
    ],
    left: [
      ['--justify-content-column', 'flex-start'],
      ['--justify-content-column-reverse', 'flex-start'],
      ['--justify-content-row', 'flex-start'],
      ['--justify-content-row-reverse', 'flex-end'],
    ],
    right: [
      ['--justify-content-column', 'flex-start'],
      ['--justify-content-column-reverse', 'flex-start'],
      ['--justify-content-row', 'flex-end'],
      ['--justify-content-row-reverse', 'flex-start'],
    ],
    'center-vertical': [
      ['--justify-content-column', 'center'],
      ['--justify-content-column-reverse', 'center'],
      ['--justify-content-row', 'flex-start'],
      ['--justify-content-row-reverse', 'flex-start'],
    ],
    'center-horizontal': [
      ['--justify-content-column', 'flex-start'],
      ['--justify-content-column-reverse', 'flex-start'],
      ['--justify-content-row', 'center'],
      ['--justify-content-row-reverse', 'center'],
    ],
    start: [
      ['--justify-content-column', 'flex-start'],
      ['--justify-content-column-reverse', 'flex-start'],
      ['--justify-content-row', 'flex-start'],
      ['--justify-content-row-reverse', 'flex-start'],
    ],
    end: [
      ['--justify-content-column', 'flex-end'],
      ['--justify-content-column-reverse', 'flex-end'],
      ['--justify-content-row', 'flex-end'],
      ['--justify-content-row-reverse', 'flex-end'],
    ],
    center: [
      ['--justify-content-column', 'center'],
      ['--justify-content-column-reverse', 'center'],
      ['--justify-content-row', 'center'],
      ['--justify-content-row-reverse', 'center'],
    ],
    'space-between': [
      ['--justify-content-column', 'space-between'],
      ['--justify-content-column-reverse', 'space-between'],
      ['--justify-content-row', 'space-between'],
      ['--justify-content-row-reverse', 'space-between'],
    ],
  },
  'linear-cross-gravity': {
    none: [],
    start: [['align-items', 'start']],
    end: [['align-items', 'end']],
    center: [['align-items', 'center']],
    stretch: [['align-items', 'stretch']],
  },
  'linear-layout-gravity': {
    none: [
      ['--align-self-row', 'auto'],
      ['--align-self-column', 'auto'],
    ],
    stretch: [
      ['--align-self-row', 'stretch'],
      ['--align-self-column', 'stretch'],
    ],
    top: [
      ['--align-self-row', 'start'],
      ['--align-self-column', 'auto'],
    ],
    bottom: [
      ['--align-self-row', 'end'],
      ['--align-self-column', 'auto'],
    ],
    left: [
      ['--align-self-row', 'auto'],
      ['--align-self-column', 'start'],
    ],
    right: [
      ['--align-self-row', 'auto'],
      ['--align-self-column', 'end'],
    ],
    start: [
      ['--align-self-row', 'start'],
      ['--align-self-column', 'start'],
    ],
    end: [
      ['--align-self-row', 'end'],
      ['--align-self-column', 'end'],
    ],
    center: [
      ['--align-self-row', 'center'],
      ['--align-self-column', 'center'],
    ],
    'center-vertical': [
      ['--align-self-row', 'center'],
      ['--align-self-column', 'start'],
    ],
    'center-horizontal': [
      ['--align-self-row', 'start'],
      ['--align-self-column', 'center'],
    ],
    'fill-vertical': [
      ['--align-self-row', 'stretch'],
      ['--align-self-column', 'auto'],
    ],
    'fill-horizontal': [
      ['--align-self-row', 'auto'],
      ['--align-self-column', 'stretch'],
    ],
  },
  'justify-content': {
    left: [],
    right: [],
    start: [
      ['justify-content', 'flex-start'],
    ],
    end: [
      ['justify-content', 'flex-end'],
    ],
  },
};

const renameRules: {
  [declarationPropertyName: string]: (string | {
    name: string;
    valueProcessor: (value: string) => string;
  })[];
} = {
  'linear-weight': [
    '--lynx-linear-weight',
    {
      name: '--lynx-linear-weight-basis',
      valueProcessor(weight) {
        return weight === '0' ? 'auto' : `0`;
      },
    },
  ],
  'color': [
    'color',
    {
      name: '--lynx-color',
      valueProcessor(value) {
        return value.includes('gradient')
          ? 'transparent'
          : value;
      },
    },
    {
      name: '--lynx-text-bg-color',
      valueProcessor(value) {
        return value.includes('gradient')
          ? value
          : 'initial';
      },
    },
    {
      name: 'background-clip',
      valueProcessor(value) {
        return value.includes('gradient')
          ? 'text'
          : 'initial';
      },
    },
    {
      name: '-webkit-background-clip',
      valueProcessor(value) {
        return value.includes('gradient')
          ? 'text'
          : 'initial';
      },
    },
  ],
  'flex-direction': [
    '--flex-direction',
  ],
  'flex-wrap': [
    '--flex-wrap',
  ],
  'flex-grow': [
    '--flex-grow',
  ],
  'flex-shrink': [
    '--flex-shrink',
  ],
  'flex-basis': [
    '--flex-basis',
  ],
  'list-main-axis-gap': [
    '--list-main-axis-gap',
  ],
  'list-cross-axis-gap': [
    '--list-cross-axis-gap',
  ],
};
export function transformLynxStyles(
  hyphenNameStyles: [string, string][],
): { childStyle: [string, string][]; transformedStyle: [string, string][] } {
  const newStyle: [string, string][] = [];
  const childStyle: [string, string][] = [];
  for (const declaration of hyphenNameStyles) {
    const [property, value] = declaration;
    const rule = replaceRules[property];
    if (rule?.[value]) {
      // remove the current
      for (
        const [newProperty, newValue] of rule[
          value
        ]!
      ) {
        newStyle.push([newProperty, newValue]);
      }
    } else if (renameRules[property]) {
      const important = value.includes('!important');
      for (const oneRule of renameRules[property]) {
        if (typeof oneRule === 'string') {
          newStyle.push([
            oneRule,
            value,
          ]);
        } else {
          newStyle.push([
            oneRule.name,
            oneRule.valueProcessor(value.replace('!important', '').trim())
            + (important ? ' !important' : ''),
          ]);
        }
      }
    } else if (property === 'flex') {
      const { flexGrow, flexShrink, flexBasis } = parseFlexShorthand(
        value,
      );
      newStyle.push([
        '--flex-grow',
        flexGrow,
      ], [
        '--flex-shrink',
        flexShrink,
      ], [
        '--flex-basis',
        flexBasis,
      ]);
    } else {
      newStyle.push(declaration);
    }
    if (property === 'linear-weight-sum') {
      let linearWeightSum = value;
      if (linearWeightSum === '0' || linearWeightSum === '0 !important') {
        linearWeightSum = '1';
      }
      childStyle.push(['--lynx-linear-weight-sum', linearWeightSum]);
    }
  }
  return { transformedStyle: newStyle, childStyle };
}

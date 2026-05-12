// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface A2UIComponentProp {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
  enums?: readonly string[];
}

export interface A2UIComponentSpec {
  name: string;
  summary: string;
  props: A2UIComponentProp[];
  requiresAction?: boolean;
  containerShape?: 'children' | 'child' | 'tabs' | 'trigger-content' | 'none';
}

export interface A2UICatalog {
  id: string;
  label: string;
  version?: string;
  components: A2UIComponentSpec[];
  extraRules?: string[];
  examples?: string[];
}

export const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/basic_catalog.json';

const prop = (
  name: string,
  type: string,
  required = false,
  description = '',
  enums?: readonly string[],
): A2UIComponentProp => ({
  name,
  type,
  required,
  description,
  ...(enums === undefined ? {} : { enums }),
});

const DYN = 'DynamicString (string | { path: string })';

export const BASIC_CATALOG: A2UICatalog = {
  id: BASIC_CATALOG_ID,
  label: 'A2UI basic catalog (v0.9)',
  version: 'v0.9',
  components: [
    {
      name: 'Text',
      summary: 'Display styled text. Supports basic markdown.',
      props: [
        prop('text', DYN, true, 'The text content.'),
        prop(
          'variant',
          'string',
          false,
          'Typography style.',
          ['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'],
        ),
      ],
    },
    {
      name: 'Image',
      summary: 'Display an image by URL.',
      props: [
        prop('url', DYN, true, 'Image URL.'),
        prop('description', DYN, false, 'Accessibility / alt text.'),
        prop(
          'fit',
          'string',
          false,
          'How the image is resized.',
          ['contain', 'cover', 'fill', 'none', 'scaleDown'],
        ),
        prop(
          'variant',
          'string',
          false,
          'Size hint.',
          [
            'icon',
            'avatar',
            'smallFeature',
            'mediumFeature',
            'largeFeature',
            'header',
          ],
        ),
      ],
    },
    {
      name: 'Icon',
      summary: 'Display a material-style icon by name.',
      props: [
        prop(
          'name',
          'string | { path: string }',
          true,
          'One of the icon enum names, or { path } for a custom path.',
        ),
      ],
    },
    {
      name: 'Video',
      summary: 'Play a video from a URL.',
      props: [prop('url', DYN, true, 'Video URL.')],
    },
    {
      name: 'AudioPlayer',
      summary: 'Play an audio file.',
      props: [
        prop('url', DYN, true, 'Audio URL.'),
        prop('description', DYN, false, 'Title / summary.'),
      ],
    },
    {
      name: 'Divider',
      summary: 'Horizontal or vertical separator line.',
      props: [
        prop('axis', 'string', false, 'Orientation.', [
          'horizontal',
          'vertical',
        ]),
      ],
    },
    {
      name: 'Row',
      summary: 'Horizontal layout container.',
      containerShape: 'children',
      props: [
        prop(
          'children',
          'string[] | ChildTemplate',
          true,
          'Child ids or a template object.',
        ),
        prop('justify', 'string', false, 'Main-axis arrangement.', [
          'start',
          'center',
          'end',
          'spaceAround',
          'spaceBetween',
          'spaceEvenly',
          'stretch',
        ]),
        prop('align', 'string', false, 'Cross-axis alignment.', [
          'start',
          'center',
          'end',
          'stretch',
        ]),
      ],
    },
    {
      name: 'Column',
      summary: 'Vertical layout container.',
      containerShape: 'children',
      props: [
        prop(
          'children',
          'string[] | ChildTemplate',
          true,
          'Child ids or a template object.',
        ),
        prop('justify', 'string', false, 'Main-axis arrangement.', [
          'start',
          'center',
          'end',
          'spaceAround',
          'spaceBetween',
          'spaceEvenly',
          'stretch',
        ]),
        prop('align', 'string', false, 'Cross-axis alignment.', [
          'start',
          'center',
          'end',
          'stretch',
        ]),
      ],
    },
    {
      name: 'List',
      summary: 'Repeating layout container, commonly bound to a data path.',
      containerShape: 'children',
      props: [
        prop(
          'children',
          'string[] | ChildTemplate',
          true,
          'Child ids or a template object.',
        ),
        prop('direction', 'string', false, 'List direction.', [
          'vertical',
          'horizontal',
        ]),
        prop('align', 'string', false, 'Cross-axis alignment.', [
          'start',
          'center',
          'end',
          'stretch',
        ]),
      ],
    },
    {
      name: 'Card',
      summary:
        'Card container with exactly one child. Wrap multiple elements in a Column/Row first.',
      containerShape: 'child',
      props: [
        prop('child', 'string (component id)', true, 'The single child id.'),
      ],
    },
    {
      name: 'Tabs',
      summary: 'Tabbed container; each tab references a child component id.',
      containerShape: 'tabs',
      props: [
        prop(
          'tabs',
          'Array<{ title: DynamicString, child: string }>',
          true,
          'At least one tab.',
        ),
      ],
    },
    {
      name: 'Modal',
      summary: 'Modal dialog with a trigger component and a content component.',
      containerShape: 'trigger-content',
      props: [
        prop('trigger', 'string (component id)', true, 'Id of the opener.'),
        prop('content', 'string (component id)', true, 'Id of modal content.'),
      ],
    },
    {
      name: 'Button',
      summary: 'Clickable button. MUST always include an action.',
      requiresAction: true,
      props: [
        prop('label', DYN, true, 'Button label.'),
        prop(
          'action',
          '{ name: string, context?: Record<string, any> }',
          true,
          'Action dispatched when clicked.',
        ),
        prop(
          'variant',
          'string',
          false,
          'Visual variant.',
          ['primary', 'secondary', 'tertiary', 'destructive'],
        ),
      ],
    },
    {
      name: 'TextField',
      summary: 'Single-line text input bound to a data path.',
      props: [
        prop('label', DYN, false, 'Field label.'),
        prop('value', '{ path: string }', true, 'Bound data path.'),
        prop('action', 'Action', false, 'Optional on-change action.'),
      ],
    },
    {
      name: 'Checkbox',
      summary: 'Boolean checkbox bound to a data path.',
      props: [
        prop('label', DYN, false, 'Checkbox label.'),
        prop('value', '{ path: string }', true, 'Bound boolean path.'),
        prop('action', 'Action', false, 'Optional on-change action.'),
      ],
    },
    {
      name: 'Slider',
      summary: 'Numeric slider.',
      props: [
        prop('value', '{ path: string }', true, 'Bound numeric path.'),
        prop('min', 'number', false),
        prop('max', 'number', false),
        prop('step', 'number', false),
        prop('action', 'Action', false),
      ],
    },
    {
      name: 'DatePicker',
      summary: 'Date selector.',
      props: [
        prop('value', '{ path: string }', true, 'Bound date path.'),
        prop('action', 'Action', false),
      ],
    },
  ],
};

export function renderCatalogReference(catalog: A2UICatalog): string {
  const lines: string[] = [];
  lines.push(
    `## Component catalog (${catalog.label}; catalogId=${catalog.id})`,
  );
  lines.push('');
  for (const c of catalog.components) {
    const required = c.props
      .filter((p) => p.required)
      .map((p) => p.name)
      .join(', ');
    const header = required
      ? `### ${c.name}  (required: ${required})`
      : `### ${c.name}`;
    lines.push(header);
    lines.push(`- ${c.summary}`);
    for (const p of c.props) {
      const req = p.required ? ' [required]' : '';
      const en = p.enums ? `  enum: ${p.enums.join(' | ')}` : '';
      const desc = p.description ? ` — ${p.description}` : '';
      lines.push(`  · ${p.name}: ${p.type}${req}${desc}${en}`);
    }
    if (c.requiresAction) {
      lines.push('  · NOTE: this component MUST include a non-empty `action`.');
    }
    lines.push('');
  }
  if (catalog.extraRules !== undefined && catalog.extraRules.length > 0) {
    lines.push('### Additional catalog rules');
    for (const r of catalog.extraRules) lines.push(`- ${r}`);
    lines.push('');
  }
  return lines.join('\n');
}

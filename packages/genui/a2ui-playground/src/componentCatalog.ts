// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ProtocolName } from './utils/protocol.js';

export interface ComponentProp {
  name: string;
  type: string;
  description: string;
  default?: string;
}

export type ComponentCategory = 'Display' | 'Layout' | 'Input' | 'Data';

export interface ComponentDoc {
  name: string;
  category: ComponentCategory;
  description: string;
  props: ComponentProp[];
  usage: Record<ProtocolName, object>;
}

export const CATEGORIES: { id: ComponentCategory; label: string }[] = [
  { id: 'Display', label: 'Display' },
  { id: 'Layout', label: 'Layout' },
  { id: 'Input', label: 'Input' },
  { id: 'Data', label: 'Data' },
];

export const COMPONENT_CATALOG: ComponentDoc[] = [
  {
    name: 'Text',
    category: 'Display',
    description: 'Displays a text string with optional style variant.',
    props: [
      {
        name: 'text',
        type: 'string | { path: string }',
        description: 'Literal text or path binding',
      },
      {
        name: 'variant',
        type: 'string',
        description: 'Text style variant: h1, h2, h3, h4, h5, caption, body',
        default: 'body',
      },
    ],
    usage: {
      a2ui: {
        id: 'greeting',
        component: 'Text',
        variant: 'h2',
        text: 'Hello, world!',
      },
      openui: {},
    },
  },
  {
    name: 'Button',
    category: 'Input',
    description: 'An interactive button that triggers an action when pressed.',
    props: [
      {
        name: 'child',
        type: 'string',
        description: 'ID of the child component rendered inside the button',
      },
      {
        name: 'action',
        type: 'object',
        description: 'v0.9 event action to trigger on press',
      },
      {
        name: 'variant',
        type: 'string',
        description: 'Button style variant: primary, borderless',
      },
    ],
    usage: {
      a2ui: {
        id: 'submit-btn',
        component: 'Button',
        action: { event: { name: 'submit' } },
        child: 'submit-btn-text',
      },
      openui: {},
    },
  },
  {
    name: 'Image',
    category: 'Display',
    description: 'Displays an image from a URL or data binding.',
    props: [
      {
        name: 'url',
        type: 'string | { path: string }',
        description: 'Image URL or path binding',
      },
      {
        name: 'fit',
        type: 'string',
        description: 'Object fit: contain, cover, fill, none, scale-down',
      },
      {
        name: 'variant',
        type: 'string',
        description:
          'Image style variant: icon, avatar, smallFeature, mediumFeature, largeFeature, header',
        default: 'mediumFeature',
      },
    ],
    usage: {
      a2ui: {
        id: 'hero-image',
        component: 'Image',
        url: 'https://picsum.photos/seed/a2ui-image-preview/320/180',
        fit: 'cover',
        variant: 'mediumFeature',
      },
      openui: {},
    },
  },
  {
    name: 'Divider',
    category: 'Display',
    description: 'A visual separator line used to divide content sections.',
    props: [
      {
        name: 'axis',
        type: 'string',
        description: 'Divider orientation: horizontal, vertical',
        default: 'horizontal',
      },
    ],
    usage: {
      a2ui: {
        id: 'section-divider',
        component: 'Divider',
        axis: 'horizontal',
      },
      openui: {},
    },
  },
  {
    name: 'Card',
    category: 'Layout',
    description: 'A container that renders one child component inside a card.',
    props: [
      {
        name: 'child',
        type: 'string',
        description: 'ID of the child component rendered inside the card',
      },
    ],
    usage: {
      a2ui: {
        id: 'info-card',
        component: 'Card',
        child: 'info-card-content',
      },
      openui: {},
    },
  },
  {
    name: 'Row',
    category: 'Layout',
    description:
      'A horizontal layout container that arranges children in a row.',
    props: [
      {
        name: 'children',
        type: 'ComponentArrayReference',
        description: 'Child components arranged horizontally',
      },
      {
        name: 'align',
        type: 'string',
        description: 'Vertical alignment: start, center, end, stretch',
        default: 'stretch',
      },
      {
        name: 'justify',
        type: 'string',
        description:
          'Horizontal distribution: start, center, end, spaceBetween, spaceAround, spaceEvenly',
        default: 'start',
      },
    ],
    usage: {
      a2ui: {
        id: 'action-row',
        component: 'Row',
        align: 'center',
        justify: 'spaceBetween',
        children: ['left-item', 'right-item'],
      },
      openui: {},
    },
  },
  {
    name: 'Column',
    category: 'Layout',
    description:
      'A vertical layout container that arranges children in a column.',
    props: [
      {
        name: 'children',
        type: 'ComponentArrayReference',
        description: 'Child components arranged vertically',
      },
      {
        name: 'align',
        type: 'string',
        description: 'Horizontal alignment: start, center, end, stretch',
        default: 'stretch',
      },
      {
        name: 'justify',
        type: 'string',
        description:
          'Vertical distribution: start, center, end, spaceBetween, spaceAround, spaceEvenly',
        default: 'start',
      },
    ],
    usage: {
      a2ui: {
        id: 'main-column',
        component: 'Column',
        align: 'start',
        justify: 'start',
        children: ['header', 'body', 'footer'],
      },
      openui: {},
    },
  },
  {
    name: 'List',
    category: 'Data',
    description:
      'A scrollable list that renders children or uses a template for dynamic items.',
    props: [
      {
        name: 'children',
        type: 'ComponentArrayReference',
        description: 'Child components or template for list items',
      },
      {
        name: 'direction',
        type: 'string',
        description: 'Scroll direction: horizontal, vertical',
        default: 'vertical',
      },
      {
        name: 'align',
        type: 'string',
        description: 'Item alignment: start, center, end, stretch',
      },
    ],
    usage: {
      a2ui: {
        id: 'item-list',
        component: 'List',
        direction: 'vertical',
        align: 'stretch',
        children: ['item-1', 'item-2', 'item-3'],
      },
      openui: {},
    },
  },
  {
    name: 'CheckBox',
    category: 'Input',
    description: 'A toggleable checkbox with label and action support.',
    props: [
      {
        name: 'label',
        type: 'string | { path: string }',
        description:
          'Label text or path binding displayed next to the checkbox',
      },
      {
        name: 'value',
        type: 'boolean | { path: string }',
        description: 'Whether the checkbox is checked, or a path binding',
        default: 'false',
      },
    ],
    usage: {
      a2ui: {
        id: 'agree-checkbox',
        component: 'CheckBox',
        label: 'I agree to the terms',
        value: false,
      },
      openui: {},
    },
  },
  {
    name: 'RadioGroup',
    category: 'Input',
    description:
      'A group of mutually exclusive radio options with selection support.',
    props: [
      {
        name: 'items',
        type: 'string[] | { path: string }',
        description: 'List of radio option labels, or a path binding',
      },
      {
        name: 'value',
        type: 'string | { path: string }',
        description: 'Value of the currently selected option',
      },
      {
        name: 'usageHint',
        type: 'string',
        description: 'Visual style hint: default, card, row',
        default: 'default',
      },
    ],
    usage: {
      a2ui: {
        id: 'size-picker',
        component: 'RadioGroup',
        items: ['Small', 'Medium', 'Large'],
        value: 'Medium',
        usageHint: 'card',
      },
      openui: {},
    },
  },
];

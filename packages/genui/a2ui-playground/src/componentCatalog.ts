// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ProtocolVersion } from './utils/protocol.js';

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
  usage: Record<ProtocolVersion, object>;
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
        type: 'TextValue',
        description: 'Content to display',
      },
      {
        name: 'usageHint',
        type: 'string',
        description: 'Text style variant: h1, h2, h3, body, caption',
        default: 'body',
      },
    ],
    usage: {
      '0.9': {
        id: 'greeting',
        component: 'Text',
        variant: 'h2',
        text: 'Hello, world!',
      },
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
        description: 'Action to trigger on press',
      },
    ],
    usage: {
      '0.9': {
        id: 'submit-btn',
        component: 'Button',
        action: { event: { name: 'submit' } },
        child: 'submit-btn-text',
      },
    },
  },
  {
    name: 'Image',
    category: 'Display',
    description: 'Displays an image from a URL with optional dimensions.',
    props: [
      { name: 'src', type: 'string', description: 'Image URL' },
      {
        name: 'alt',
        type: 'string',
        description: 'Alternative text for accessibility',
      },
      {
        name: 'width',
        type: 'number',
        description: 'Image width in logical pixels',
      },
      {
        name: 'height',
        type: 'number',
        description: 'Image height in logical pixels',
      },
    ],
    usage: {
      '0.9': {
        id: 'hero-image',
        component: 'Image',
        src: 'https://example.com/hero.png',
        alt: 'Hero banner',
        width: 320,
        height: 180,
      },
    },
  },
  {
    name: 'Divider',
    category: 'Display',
    description: 'A visual separator line used to divide content sections.',
    props: [
      {
        name: 'direction',
        type: 'string',
        description: 'Divider orientation: horizontal, vertical',
        default: 'horizontal',
      },
      {
        name: 'color',
        type: 'string',
        description: 'Divider line color as a CSS color value',
      },
    ],
    usage: {
      '0.9': {
        id: 'section-divider',
        component: 'Divider',
        direction: 'horizontal',
        color: '#E0E0E0',
      },
    },
  },
  {
    name: 'Card',
    category: 'Layout',
    description: 'A container with visual elevation or outline styling.',
    props: [
      {
        name: 'child',
        type: 'string',
        description: 'ID of the child component rendered inside the card',
      },
      {
        name: 'usageHint',
        type: 'string',
        description: 'Card style: elevated, outlined, filled',
        default: 'elevated',
      },
    ],
    usage: {
      '0.9': {
        id: 'info-card',
        component: 'Card',
        usageHint: 'elevated',
        child: 'info-card-content',
      },
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
        name: 'alignment',
        type: 'string',
        description: 'Vertical alignment: start, center, end, stretch',
        default: 'center',
      },
      {
        name: 'distribution',
        type: 'string',
        description:
          'Horizontal distribution: start, center, end, spaceBetween, spaceAround, spaceEvenly',
        default: 'start',
      },
    ],
    usage: {
      '0.9': {
        id: 'action-row',
        component: 'Row',
        alignment: 'center',
        distribution: 'spaceBetween',
        children: ['left-item', 'right-item'],
      },
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
        name: 'usageHint',
        type: 'string',
        description: 'Column role: root-column, group',
        default: 'group',
      },
    ],
    usage: {
      '0.9': {
        id: 'main-column',
        component: 'Column',
        usageHint: 'root-column',
        children: ['header', 'body', 'footer'],
      },
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
        name: 'template',
        type: 'object',
        description: 'Template for dynamic item rendering with data binding',
      },
    ],
    usage: {
      '0.9': {
        id: 'item-list',
        component: 'List',
        children: ['item-1', 'item-2', 'item-3'],
        template: {
          dataSource: '/items',
          component: 'Text',
          variant: 'body',
          text: { path: '/items/$/name' },
        },
      },
    },
  },
  {
    name: 'CheckBox',
    category: 'Input',
    description: 'A toggleable checkbox with label and action support.',
    props: [
      {
        name: 'label',
        type: 'string',
        description: 'Label text displayed next to the checkbox',
      },
      {
        name: 'checked',
        type: 'boolean',
        description: 'Whether the checkbox is checked',
        default: 'false',
      },
      {
        name: 'action',
        type: 'object',
        description: 'Action triggered when the checkbox is toggled',
      },
    ],
    usage: {
      '0.9': {
        id: 'agree-checkbox',
        component: 'CheckBox',
        label: 'I agree to the terms',
        checked: false,
        action: { event: { name: 'toggle_agree' } },
      },
    },
  },
  {
    name: 'RadioGroup',
    category: 'Input',
    description:
      'A group of mutually exclusive radio options with selection support.',
    props: [
      {
        name: 'options',
        type: 'array',
        description: 'List of radio options with label and value',
      },
      {
        name: 'selected',
        type: 'string',
        description: 'Value of the currently selected option',
      },
      {
        name: 'action',
        type: 'object',
        description: 'Action triggered when the selection changes',
      },
    ],
    usage: {
      '0.9': {
        id: 'size-picker',
        component: 'RadioGroup',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
        selected: 'md',
        action: { event: { name: 'select_size' } },
      },
    },
  },
];

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import buttonManifest from '@lynx-js/a2ui-reactlynx/catalog/Button/catalog.json';
import cardManifest from '@lynx-js/a2ui-reactlynx/catalog/Card/catalog.json';
import checkBoxManifest from '@lynx-js/a2ui-reactlynx/catalog/CheckBox/catalog.json';
import columnManifest from '@lynx-js/a2ui-reactlynx/catalog/Column/catalog.json';
import dividerManifest from '@lynx-js/a2ui-reactlynx/catalog/Divider/catalog.json';
import iconManifest from '@lynx-js/a2ui-reactlynx/catalog/Icon/catalog.json';
import imageManifest from '@lynx-js/a2ui-reactlynx/catalog/Image/catalog.json';
import listManifest from '@lynx-js/a2ui-reactlynx/catalog/List/catalog.json';
import radioGroupManifest from '@lynx-js/a2ui-reactlynx/catalog/RadioGroup/catalog.json';
import rowManifest from '@lynx-js/a2ui-reactlynx/catalog/Row/catalog.json';
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json';

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

type PropSchema = Record<string, unknown>;

function inferType(prop: PropSchema): string {
  if (Array.isArray(prop.oneOf)) {
    return (prop.oneOf as PropSchema[]).map((v) => inferType(v)).join(' | ');
  }
  if (prop.type === 'string') {
    if (Array.isArray(prop.enum)) {
      return (prop.enum as string[]).map((v) => `"${v}"`).join(' | ');
    }
    return 'string';
  }
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'number') return 'number';
  if (prop.type === 'array') return 'string[]';
  if (prop.type === 'object') {
    const props = prop.properties as Record<string, unknown> | undefined;
    if (!props) return 'object';
    const keys = Object.keys(props);
    if (keys.length === 1 && keys[0] === 'path') return '{ path: string }';
    if (keys.includes('componentId') && keys.includes('path')) {
      return '{ componentId: string; path: string }';
    }
    return 'object';
  }
  return 'unknown';
}

function schemaToProps(manifest: Record<string, unknown>): ComponentProp[] {
  const key = Object.keys(manifest)[0];
  if (!key) return [];
  const schema = manifest[key] as PropSchema;
  const properties = (schema.properties as Record<string, PropSchema>) ?? {};
  const required = (schema.required as string[]) ?? [];
  return Object.entries(properties).map(([name, propSchema]) => {
    const prop: ComponentProp = {
      name,
      type: inferType(propSchema),
      description: (propSchema.description as string | undefined) ?? '',
    };
    if (!required.includes(name)) prop.default = 'optional';
    return prop;
  });
}

export const COMPONENT_CATALOG: ComponentDoc[] = [
  {
    name: 'Text',
    category: 'Display',
    description: 'Displays a text string with optional style variant.',
    props: schemaToProps(textManifest),
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
    name: 'Icon',
    category: 'Display',
    description:
      'Renders a Material icon by name. Supports camelCase or snake_case icon names.',
    props: schemaToProps(iconManifest),
    usage: {
      a2ui: {
        id: 'status-icon',
        component: 'Icon',
        name: 'info',
      },
      openui: {},
    },
  },
  {
    name: 'Image',
    category: 'Display',
    description: 'Displays an image from a URL or data binding.',
    props: schemaToProps(imageManifest),
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
    props: schemaToProps(dividerManifest),
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
    props: schemaToProps(cardManifest),
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
    props: schemaToProps(rowManifest),
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
    props: schemaToProps(columnManifest),
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
    props: schemaToProps(listManifest),
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
    name: 'Button',
    category: 'Input',
    description: 'An interactive button that triggers an action when pressed.',
    props: schemaToProps(buttonManifest),
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
    name: 'CheckBox',
    category: 'Input',
    description: 'A toggleable checkbox with label and action support.',
    props: schemaToProps(checkBoxManifest),
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
    props: schemaToProps(radioGroupManifest),
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

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
import lineChartManifest from '@lynx-js/a2ui-reactlynx/catalog/LineChart/catalog.json';
import listManifest from '@lynx-js/a2ui-reactlynx/catalog/List/catalog.json';
import modalManifest from '@lynx-js/a2ui-reactlynx/catalog/Modal/catalog.json';
import pieChartManifest from '@lynx-js/a2ui-reactlynx/catalog/PieChart/catalog.json';
import radioGroupManifest from '@lynx-js/a2ui-reactlynx/catalog/RadioGroup/catalog.json';
import rowManifest from '@lynx-js/a2ui-reactlynx/catalog/Row/catalog.json';
import sliderManifest from '@lynx-js/a2ui-reactlynx/catalog/Slider/catalog.json';
import tabsManifest from '@lynx-js/a2ui-reactlynx/catalog/Tabs/catalog.json';
import textManifest from '@lynx-js/a2ui-reactlynx/catalog/Text/catalog.json';
import textFieldManifest from '@lynx-js/a2ui-reactlynx/catalog/TextField/catalog.json';

import type { ProtocolName } from './utils/protocol.js';

export interface ComponentProp {
  name: string;
  type: string;
  description: string;
  default?: string;
}

export interface ComponentUsageExample {
  label: string;
  value: object | object[];
}

export type ComponentCategory =
  | 'Display'
  | 'Layout'
  | 'Input'
  | 'Data'
  | 'Chart';

export interface ComponentDoc {
  name: string;
  category: ComponentCategory;
  description: string;
  props: ComponentProp[];
  usage: Record<ProtocolName, object | object[]>;
  usageExamples: Record<ProtocolName, ComponentUsageExample[]>;
}

export const CATEGORIES: { id: ComponentCategory; label: string }[] = [
  { id: 'Display', label: 'Display' },
  { id: 'Layout', label: 'Layout' },
  { id: 'Input', label: 'Input' },
  { id: 'Data', label: 'Data' },
  { id: 'Chart', label: 'Chart' },
];

type PropSchema = Record<string, unknown>;

function inferType(prop: PropSchema): string {
  if (Array.isArray(prop.oneOf)) {
    return (prop.oneOf as PropSchema[]).map((v) => inferType(v)).join(' | ');
  }
  if (prop.type === 'array') {
    const items = prop.items as PropSchema | undefined;
    if (items && items.type === 'object' && items.properties) {
      const fields = Object.entries(
        items.properties as Record<string, PropSchema>,
      ).map(([name, schema]) => `${name}: ${inferType(schema)}`);
      return `Array<{ ${fields.join('; ')} }>`;
    }
    if (items) return `${inferType(items)}[]`;
    return 'unknown[]';
  }
  if (prop.type === 'string') {
    if (Array.isArray(prop.enum)) {
      return (prop.enum as string[]).map((v) => `"${v}"`).join(' | ');
    }
    return 'string';
  }
  if (prop.type === 'boolean') return 'boolean';
  if (prop.type === 'number') return 'number';
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
    usageExamples: {
      a2ui: [
        {
          label: 'Headline',
          value: {
            id: 'hero-title',
            component: 'Text',
            variant: 'h1',
            text: 'Build with Lynx',
            weight: 700,
          },
        },
        {
          label: 'Body',
          value: {
            id: 'body-copy',
            component: 'Text',
            variant: 'body',
            text: 'Build with Lynx',
            weight: 500,
          },
        },
        {
          label: 'Caption',
          value: {
            id: 'caption-copy',
            component: 'Text',
            variant: 'caption',
            text: 'Build with Lynx',
            weight: 300,
          },
        },
        {
          label: 'Markdown',
          value: {
            id: 'markdown-copy',
            component: 'Text',
            variant: 'markdown',
            text: '# Markdown title\n\n'
              + 'This **Text** example renders markdown content.\n\n'
              + '- Supports headings\n'
              + '- Supports lists\n'
              + '- Supports inline `code`',
          },
        },
      ],
      openui: [],
    },
  },
  {
    name: 'Icon',
    category: 'Display',
    description:
      'Renders a Material icon by name. Default icon names can be browsed at https://a2ui-composer.ag-ui.com/icons.',
    props: schemaToProps(iconManifest),
    usage: {
      a2ui: [
        {
          id: 'icon-primary-row',
          component: 'Row',
          align: 'center',
          justify: 'start',
          children: [
            'info-icon',
            'add-icon',
            'search-icon',
            'settings-icon',
          ],
        },
        {
          id: 'info-icon',
          component: 'Icon',
          name: 'info',
          size: 'md',
          color: 'primary',
        },
        {
          id: 'add-icon',
          component: 'Icon',
          name: 'add',
          size: 'md',
          color: 'primary',
        },
        {
          id: 'search-icon',
          component: 'Icon',
          name: 'search',
          size: 'md',
          color: 'primary',
        },
        {
          id: 'settings-icon',
          component: 'Icon',
          size: 'md',
          name: 'settings',
          color: 'primary',
        },
      ],
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Primary',
          value: [
            {
              id: 'icon-primary-row',
              component: 'Row',
              align: 'center',
              justify: 'start',
              children: [
                'info-icon',
                'add-icon',
                'search-icon',
                'settings-icon',
              ],
            },
            {
              id: 'info-icon',
              component: 'Icon',
              name: 'info',
              size: 'md',
              color: 'primary',
            },
            {
              id: 'add-icon',
              component: 'Icon',
              name: 'add',
              size: 'md',
              color: 'primary',
            },
            {
              id: 'search-icon',
              component: 'Icon',
              name: 'search',
              size: 'md',
              color: 'primary',
            },
            {
              id: 'settings-icon',
              component: 'Icon',
              size: 'md',
              name: 'settings',
              color: 'primary',
            },
          ],
        },
        {
          label: 'Muted',
          value: [
            {
              id: 'icon-muted-row',
              component: 'Row',
              align: 'center',
              justify: 'start',
              children: [
                'play-icon',
                'bookmark-icon',
                'schedule-icon',
                'photo-icon',
              ],
            },
            {
              id: 'play-icon',
              component: 'Icon',
              name: 'play_arrow',
              size: 'md',
              color: 'muted',
            },
            {
              id: 'bookmark-icon',
              component: 'Icon',
              name: 'bookmark_border',
              size: 'md',
              color: 'muted',
            },
            {
              id: 'schedule-icon',
              component: 'Icon',
              name: 'schedule',
              size: 'md',
              color: 'muted',
            },
            {
              id: 'photo-icon',
              component: 'Icon',
              name: 'photo',
              size: 'md',
              color: 'muted',
            },
          ],
        },
        {
          label: 'Inherited',
          value: [
            {
              id: 'icon-inherited-row',
              component: 'Row',
              align: 'center',
              justify: 'start',
              children: [
                'check-icon',
                'error-icon',
                'help-icon',
                'star-icon',
              ],
            },
            {
              id: 'check-icon',
              component: 'Icon',
              name: 'check_circle',
              size: 'md',
              color: 'inherit',
            },
            {
              id: 'error-icon',
              component: 'Icon',
              name: 'error_outline',
              size: 'md',
              color: 'inherit',
            },
            {
              id: 'help-icon',
              component: 'Icon',
              name: 'help_outline',
              size: 'md',
              color: 'inherit',
            },
            {
              id: 'star-icon',
              component: 'Icon',
              name: 'star',
              size: 'md',
              color: 'inherit',
            },
          ],
        },
      ],
      openui: [],
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
    usageExamples: {
      a2ui: [
        {
          label: 'Feature',
          value: {
            id: 'feature-image',
            component: 'Image',
            url: 'https://picsum.photos/seed/a2ui-image-feature/480/280',
            fit: 'cover',
            variant: 'largeFeature',
          },
        },
        {
          label: 'Avatar',
          value: {
            id: 'avatar-image',
            component: 'Image',
            url: 'https://picsum.photos/seed/a2ui-image-avatar/160/160',
            fit: 'cover',
            variant: 'avatar',
          },
        },
        {
          label: 'Contain',
          value: {
            id: 'icon-image',
            component: 'Image',
            url: 'https://picsum.photos/seed/a2ui-image-icon/120/120',
            fit: 'contain',
            variant: 'icon',
          },
        },
      ],
      openui: [],
    },
  },
  {
    name: 'Divider',
    category: 'Display',
    description: 'A visual separator line used to divide content sections.',
    props: schemaToProps(dividerManifest),
    usage: {
      a2ui: [
        {
          id: 'root',
          component: 'Column',
          align: 'stretch',
          justify: 'start',
          children: ['top-section', 'section-divider', 'bottom-section'],
        },
        {
          id: 'top-section',
          component: 'Text',
          text: 'Top section',
          variant: 'h3',
          weight: 600,
        },
        {
          id: 'section-divider',
          component: 'Divider',
          axis: 'horizontal',
        },
        {
          id: 'bottom-section',
          component: 'Text',
          text: 'Bottom section',
          variant: 'body',
        },
      ],
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Horizontal',
          value: [
            {
              id: 'root',
              component: 'Column',
              align: 'stretch',
              justify: 'start',
              children: ['top-note', 'horizontal-divider', 'bottom-note'],
            },
            {
              id: 'top-note',
              component: 'Text',
              text: 'Orders',
              variant: 'h3',
            },
            {
              id: 'horizontal-divider',
              component: 'Divider',
              axis: 'horizontal',
            },
            {
              id: 'bottom-note',
              component: 'Text',
              text: 'Last updated 2 minutes ago',
              variant: 'caption',
            },
          ],
        },
        {
          label: 'Vertical',
          value: [
            {
              id: 'root',
              component: 'Row',
              align: 'center',
              justify: 'start',
              children: ['left-panel', 'vertical-divider', 'right-panel'],
            },
            {
              id: 'left-panel',
              component: 'Column',
              align: 'stretch',
              justify: 'start',
              children: ['overview-title', 'overview-note'],
            },
            {
              id: 'overview-title',
              component: 'Text',
              text: 'Daily summary',
              variant: 'h3',
            },
            {
              id: 'overview-note',
              component: 'Text',
              text: 'Revenue and order volume continue to climb.',
              variant: 'caption',
            },
            {
              id: 'vertical-divider',
              component: 'Divider',
              axis: 'vertical',
            },
            {
              id: 'right-panel',
              component: 'Column',
              align: 'stretch',
              justify: 'start',
              children: ['right-title', 'right-copy'],
            },
            {
              id: 'right-title',
              component: 'Text',
              text: 'Insights',
              variant: 'h3',
            },
            {
              id: 'right-copy',
              component: 'Text',
              text: 'Divide content into two independent columns.',
              variant: 'body',
            },
          ],
        },
      ],
      openui: [],
    },
  },
  {
    name: 'LineChart',
    category: 'Chart',
    description:
      'Plots one or more numeric series over category labels with native SVG rendering.',
    props: schemaToProps(lineChartManifest),
    usage: {
      a2ui: {
        id: 'sales-chart',
        component: 'LineChart',
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        series: [
          {
            name: 'Revenue',
            values: [120, 180, 160, 220, 260, 240],
            color: '#0057d9',
          },
          {
            name: 'Orders',
            values: [80, 92, 104, 118, 126, 140],
            color: '#0a8f8f',
          },
        ],
        variant: 'natural',
        xLabel: 'Month',
        yLabel: 'Performance',
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Multi-series',
          value: {
            id: 'multi-series-chart',
            component: 'LineChart',
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            series: [
              {
                name: 'Revenue',
                values: [120, 180, 160, 220, 260, 240],
                color: '#0057d9',
              },
              {
                name: 'Orders',
                values: [80, 92, 104, 118, 126, 140],
                color: '#0a8f8f',
              },
            ],
            variant: 'natural',
            xLabel: 'Month',
            yLabel: 'Performance',
          },
        },
        {
          label: 'Stepped',
          value: {
            id: 'step-chart',
            component: 'LineChart',
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            series: [
              {
                name: 'Traffic',
                values: [32, 42, 39, 51, 58],
                color: '#8a5cf6',
              },
            ],
            variant: 'step',
            xLabel: 'Day',
            yLabel: 'Traffic',
          },
        },
      ],
      openui: [],
    },
  },
  {
    name: 'PieChart',
    category: 'Chart',
    description:
      'Renders pie and donut slices with native SVG arcs and a responsive legend.',
    props: schemaToProps(pieChartManifest),
    usage: {
      a2ui: {
        id: 'revenue-share',
        component: 'PieChart',
        variant: 'donut',
        title: 'Revenue mix',
        subtitle: 'This month',
        data: [
          { name: 'Subscriptions', value: 48, color: '#0057d9' },
          { name: 'Services', value: 26, color: '#0a8f8f' },
          { name: 'Licensing', value: 16, color: '#8a5cf6' },
          { name: 'Other', value: 10, color: '#d92d20' },
        ],
        paddingAngle: 2,
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Donut',
          value: {
            id: 'donut-revenue-share',
            component: 'PieChart',
            variant: 'donut',
            title: 'Revenue mix',
            subtitle: 'This month',
            data: [
              { name: 'Subscriptions', value: 48, color: '#0057d9' },
              { name: 'Services', value: 26, color: '#0a8f8f' },
              { name: 'Licensing', value: 16, color: '#8a5cf6' },
              { name: 'Other', value: 10, color: '#d92d20' },
            ],
            paddingAngle: 2,
          },
        },
        {
          label: 'Flat pie',
          value: {
            id: 'flat-audience-share',
            component: 'PieChart',
            variant: 'pie',
            title: 'Audience split',
            subtitle: 'Active users by region',
            data: [
              { name: 'Asia', value: 42, color: '#0057d9' },
              { name: 'Europe', value: 28, color: '#0a8f8f' },
              { name: 'North America', value: 18, color: '#8a5cf6' },
              { name: 'Other', value: 12, color: '#b26a00' },
            ],
            paddingAngle: 3,
          },
        },
      ],
      openui: [],
    },
  },
  {
    name: 'Card',
    category: 'Layout',
    description: 'A container that renders one child component inside a card.',
    props: schemaToProps(cardManifest),
    usage: {
      a2ui: {
        id: 'profile-card',
        component: 'Card',
        child: 'profile-card-body',
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Elevated',
          value: [
            {
              id: 'profile-card',
              component: 'Card',
              child: 'profile-card-body',
              variant: 'elevated',
            },
            {
              id: 'profile-card-body',
              component: 'Column',
              children: [
                'profile-title',
                'profile-subtitle',
                'profile-summary',
              ],
              align: 'stretch',
              justify: 'start',
            },
            {
              id: 'profile-title',
              component: 'Text',
              text: 'Maya Chen',
              variant: 'h3',
            },
            {
              id: 'profile-subtitle',
              component: 'Text',
              text: 'Product designer',
              variant: 'caption',
            },
            {
              id: 'profile-summary',
              component: 'Text',
              text:
                'Shipping updates and review status are visible at a glance.',
              variant: 'body',
            },
          ],
        },
        {
          label: 'Outlined',
          value: [
            {
              id: 'stats-card',
              component: 'Card',
              child: 'stats-card-body',
              variant: 'outlined',
            },
            {
              id: 'stats-card-body',
              component: 'Column',
              children: ['stats-title', 'stats-value', 'stats-note'],
              align: 'stretch',
              justify: 'start',
            },
            {
              id: 'stats-title',
              component: 'Text',
              text: 'Weekly active users',
              variant: 'h4',
            },
            {
              id: 'stats-value',
              component: 'Text',
              text: '24.8k active',
              variant: 'h2',
            },
            {
              id: 'stats-note',
              component: 'Text',
              text: 'Compared with last week, the audience is growing.',
              variant: 'caption',
            },
          ],
        },
        {
          label: 'Filled',
          value: [
            {
              id: 'checkout-card',
              component: 'Card',
              child: 'checkout-card-body',
              variant: 'filled',
            },
            {
              id: 'checkout-card-body',
              component: 'Column',
              children: [
                'checkout-title',
                'checkout-subtitle',
                'checkout-total',
              ],
              align: 'stretch',
              justify: 'start',
            },
            {
              id: 'checkout-title',
              component: 'Text',
              text: 'Checkout',
              variant: 'h3',
            },
            {
              id: 'checkout-subtitle',
              component: 'Text',
              text: '2 items in bag',
              variant: 'caption',
            },
            {
              id: 'checkout-total',
              component: 'Text',
              text: '$168.00',
              variant: 'h2',
            },
          ],
        },
      ],
      openui: [],
    },
  },
  {
    name: 'Modal',
    category: 'Layout',
    description:
      'A modal dialog that opens from a trigger component and displays one content component.',
    props: schemaToProps(modalManifest),
    usage: {
      a2ui: [
        {
          id: 'details-modal',
          component: 'Modal',
          trigger: 'details-trigger',
          content: 'details-content',
        },
        {
          id: 'details-trigger',
          component: 'Button',
          action: { event: { name: 'open_details' } },
          child: 'details-trigger-text',
        },
        {
          id: 'details-trigger-text',
          component: 'Text',
          text: 'Open details',
        },
        {
          id: 'details-content',
          component: 'Column',
          align: 'stretch',
          children: ['details-title', 'details-copy'],
        },
        {
          id: 'details-title',
          component: 'Text',
          text: 'Details',
          variant: 'h3',
        },
        {
          id: 'details-copy',
          component: 'Text',
          text: 'This content is rendered inside a Lynx UI dialog.',
          variant: 'body',
        },
      ],
      openui: {},
    },
    usageExamples: {
      a2ui: [],
      openui: [],
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
        children: [
          'leading-avatar',
          'title-stack',
          'status-chip',
          'more-action',
        ],
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Balanced',
          value: [
            {
              id: 'profile-row',
              component: 'Row',
              align: 'center',
              justify: 'spaceBetween',
              children: [
                'leading-avatar',
                'title-copy',
                'status-chip',
                'more-icon',
              ],
            },
            {
              id: 'leading-avatar',
              component: 'Image',
              url: 'https://picsum.photos/seed/row-avatar/80/80',
              fit: 'cover',
              variant: 'avatar',
            },
            {
              id: 'title-copy',
              component: 'Text',
              text: 'Notification settings',
              variant: 'h4',
            },
            {
              id: 'status-chip',
              component: 'Text',
              text: 'Enabled',
              variant: 'caption',
            },
            {
              id: 'more-icon',
              component: 'Text',
              text: '⋯',
            },
          ],
        },
        {
          label: 'Compact',
          value: [
            {
              id: 'compact-row',
              component: 'Row',
              align: 'start',
              justify: 'center',
              children: ['filter-chip', 'sort-chip', 'clear-chip', 'more-chip'],
            },
            {
              id: 'filter-chip',
              component: 'Text',
              text: 'Filter',
              variant: 'caption',
            },
            {
              id: 'sort-chip',
              component: 'Text',
              text: 'Sort',
              variant: 'caption',
            },
            {
              id: 'clear-chip',
              component: 'Text',
              text: 'Clear',
              variant: 'caption',
            },
            {
              id: 'more-chip',
              component: 'Text',
              text: 'More',
              variant: 'caption',
            },
          ],
        },
        {
          label: 'Spread',
          value: [
            {
              id: 'spread-row',
              component: 'Row',
              align: 'stretch',
              justify: 'spaceAround',
              children: ['left-meta', 'center-meta', 'right-meta'],
            },
            {
              id: 'left-meta',
              component: 'Text',
              text: '12 drafts',
              variant: 'body',
            },
            {
              id: 'center-meta',
              component: 'Text',
              text: '48 published',
              variant: 'body',
            },
            {
              id: 'right-meta',
              component: 'Text',
              text: '99% success',
              variant: 'body',
            },
          ],
        },
      ],
      openui: [],
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
        align: 'stretch',
        justify: 'start',
        children: ['header-row', 'summary-panel', 'detail-stack', 'footer-row'],
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Standard',
          value: [
            {
              id: 'main-column',
              component: 'Column',
              align: 'stretch',
              justify: 'start',
              children: ['header-text', 'summary-text', 'footer-text'],
            },
            {
              id: 'header-text',
              component: 'Text',
              text: 'Order details',
              variant: 'h2',
            },
            {
              id: 'summary-text',
              component: 'Text',
              text: '32 items · $128 subtotal · 4.8 rating',
              variant: 'body',
            },
            {
              id: 'footer-text',
              component: 'Text',
              text: 'All prices shown in USD',
              variant: 'caption',
            },
          ],
        },
        {
          label: 'Center',
          value: [
            {
              id: 'center-column',
              component: 'Column',
              align: 'center',
              justify: 'center',
              children: ['title-block', 'subtitle-block', 'supporting-note'],
            },
            {
              id: 'title-block',
              component: 'Text',
              text: 'Centered title',
              variant: 'h3',
            },
            {
              id: 'subtitle-block',
              component: 'Text',
              text: 'Secondary line',
              variant: 'body',
            },
            {
              id: 'supporting-note',
              component: 'Text',
              text: 'Alignment keeps the stack balanced.',
              variant: 'caption',
            },
          ],
        },
        {
          label: 'Space Between',
          value: [
            {
              id: 'space-between-column',
              component: 'Column',
              align: 'stretch',
              justify: 'spaceBetween',
              children: ['top-text', 'middle-text', 'bottom-text'],
            },
            {
              id: 'top-text',
              component: 'Text',
              text: 'Top pinned',
              variant: 'caption',
            },
            {
              id: 'middle-text',
              component: 'Text',
              text: 'Main content stretches between the edges.',
              variant: 'body',
            },
            {
              id: 'bottom-text',
              component: 'Text',
              text: 'Bottom flexible',
              variant: 'caption',
            },
          ],
        },
      ],
      openui: [],
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
        children: ['item-card-1', 'item-card-2', 'item-card-3', 'item-card-4'],
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Vertical',
          value: [
            {
              id: 'item-list',
              component: 'List',
              direction: 'vertical',
              align: 'stretch',
              children: ['item-1', 'item-2', 'item-3', 'item-4'],
            },
            {
              id: 'item-1',
              component: 'Text',
              text: 'Saffron latte · $5.40',
              variant: 'body',
            },
            {
              id: 'item-2',
              component: 'Text',
              text: 'Cold brew · $4.80',
              variant: 'body',
            },
            {
              id: 'item-3',
              component: 'Text',
              text: 'Cappuccino · $4.20',
              variant: 'body',
            },
            {
              id: 'item-4',
              component: 'Text',
              text: 'Flat white · $4.90',
              variant: 'body',
            },
          ],
        },
        {
          label: 'Horizontal',
          value: [
            {
              id: 'h-list',
              component: 'List',
              direction: 'horizontal',
              align: 'center',
              children: ['tile-1', 'tile-2', 'tile-3', 'tile-4'],
            },
            {
              id: 'tile-1',
              component: 'Text',
              text: 'Mon',
              variant: 'body',
            },
            {
              id: 'tile-2',
              component: 'Text',
              text: 'Tue',
              variant: 'body',
            },
            {
              id: 'tile-3',
              component: 'Text',
              text: 'Wed',
              variant: 'body',
            },
            {
              id: 'tile-4',
              component: 'Text',
              text: 'Thu',
              variant: 'body',
            },
          ],
        },
      ],
      openui: [],
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
    usageExamples: {
      a2ui: [
        {
          label: 'Primary',
          value: [
            {
              id: 'submit-btn',
              component: 'Button',
              variant: 'primary',
              action: { event: { name: 'submit' } },
              child: 'submit-btn-text',
            },
            {
              id: 'submit-btn-text',
              component: 'Text',
              text: 'Submit',
            },
          ],
        },
        {
          label: 'Borderless',
          value: [
            {
              id: 'secondary-btn',
              component: 'Button',
              variant: 'borderless',
              action: { event: { name: 'secondary_action' } },
              child: 'secondary-btn-text',
            },
            {
              id: 'secondary-btn-text',
              component: 'Text',
              text: 'More options',
            },
          ],
        },
      ],
      openui: [],
    },
  },
  {
    name: 'TextField',
    category: 'Input',
    description:
      'A labeled text input with short text, long text, numeric, and obscured variants.',
    props: schemaToProps(textFieldManifest),
    usage: {
      a2ui: {
        id: 'name-input',
        component: 'TextField',
        label: 'Name',
        value: { path: '/form/name' },
        variant: 'shortText',
      },
      openui: {
        id: 'name-input',
        component: 'TextField',
        label: 'Name',
        value: { path: '/form/name' },
        variant: 'shortText',
      },
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Short Text',
          value: {
            id: 'email-input',
            component: 'TextField',
            label: 'Email',
            value: { path: '/form/email' },
            variant: 'shortText',
          },
        },
        {
          label: 'Long Text',
          value: {
            id: 'bio-input',
            component: 'TextField',
            label: 'Bio',
            value: { path: '/form/bio' },
            variant: 'longText',
          },
        },
        {
          label: 'Obscured',
          value: {
            id: 'password-input',
            component: 'TextField',
            label: 'Password',
            value: { path: '/form/password' },
            variant: 'obscured',
          },
        },
        {
          label: 'Number',
          value: {
            id: 'age-input',
            component: 'TextField',
            label: 'Age',
            value: { path: '/form/age' },
            variant: 'number',
          },
        },
      ],
      openui: [
        {
          label: 'Short Text',
          value: {
            id: 'name-input',
            component: 'TextField',
            label: 'Name',
            value: { path: '/form/name' },
            variant: 'shortText',
          },
        },
      ],
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
    usageExamples: {
      a2ui: [
        {
          label: 'Unchecked',
          value: {
            id: 'agree-checkbox',
            component: 'CheckBox',
            label: 'I agree to the terms',
            value: false,
          },
        },
        {
          label: 'Checked',
          value: {
            id: 'subscribe-checkbox',
            component: 'CheckBox',
            label: 'Subscribe to updates',
            value: true,
          },
        },
      ],
      openui: [],
    },
  },
  {
    name: 'Slider',
    category: 'Input',
    description: 'A numeric range input backed by lynx-ui slider primitives.',
    props: schemaToProps(sliderManifest),
    usage: {
      a2ui: {
        id: 'volume-slider',
        component: 'Slider',
        label: 'Volume',
        value: 40,
        min: 0,
        max: 100,
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Percent',
          value: {
            id: 'volume-slider',
            component: 'Slider',
            label: 'Volume',
            value: 40,
            min: 0,
            max: 100,
          },
        },
        {
          label: 'Progress',
          value: {
            id: 'progress-slider',
            component: 'Slider',
            label: 'Progress',
            value: 0.35,
            min: 0,
            max: 1,
          },
        },
      ],
      openui: [],
    },
  },
  {
    name: 'Tabs',
    category: 'Layout',
    description: 'A tab bar that switches between multiple child components.',
    props: schemaToProps(tabsManifest),
    usage: {
      a2ui: {
        id: 'details-tabs',
        component: 'Tabs',
        tabs: [
          { title: 'Overview', child: 'overview-panel' },
          { title: 'Specs', child: 'specs-panel' },
          { title: 'Reviews', child: 'reviews-panel' },
        ],
      },
      openui: {},
    },
    usageExamples: {
      a2ui: [
        {
          label: 'Default',
          value: [
            {
              id: 'details-tabs',
              component: 'Tabs',
              tabs: [
                { title: 'Overview', child: 'overview-panel' },
                { title: 'Specs', child: 'specs-panel' },
                { title: 'Reviews', child: 'reviews-panel' },
              ],
            },
            {
              id: 'overview-panel',
              component: 'Column',
              children: ['overview-title', 'overview-note'],
              align: 'stretch',
            },
            {
              id: 'overview-title',
              component: 'Text',
              text: 'Mediterranean Quinoa Bowl',
              variant: 'h3',
            },
            {
              id: 'overview-note',
              component: 'Text',
              text: 'Fresh ingredients and quick prep',
              variant: 'caption',
            },
            {
              id: 'specs-panel',
              component: 'Column',
              children: ['spec-title', 'spec-note'],
              align: 'stretch',
            },
            {
              id: 'spec-title',
              component: 'Text',
              text: '420 calories',
              variant: 'h4',
            },
            {
              id: 'spec-note',
              component: 'Text',
              text: '13g protein · easy to prepare',
              variant: 'body',
            },
            {
              id: 'reviews-panel',
              component: 'Column',
              children: ['review-title', 'review-note'],
              align: 'stretch',
            },
            {
              id: 'review-title',
              component: 'Text',
              text: '★★★★★ 4.9 average',
              variant: 'h4',
            },
            {
              id: 'review-note',
              component: 'Text',
              text: 'Feels fresh and filling.',
              variant: 'caption',
            },
          ],
        },
      ],
      openui: [],
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
    usageExamples: {
      a2ui: [
        {
          label: 'Card',
          value: {
            id: 'size-picker',
            component: 'RadioGroup',
            items: ['Small', 'Medium', 'Large'],
            value: 'Medium',
            usageHint: 'card',
          },
        },
        {
          label: 'Row',
          value: {
            id: 'delivery-option-picker',
            component: 'RadioGroup',
            items: ['Standard', 'Express', 'Pickup'],
            value: 'Express',
            usageHint: 'row',
          },
        },
        {
          label: 'Default',
          value: {
            id: 'tone-picker',
            component: 'RadioGroup',
            items: ['Calm', 'Neutral', 'Bold'],
            value: 'Neutral',
            usageHint: 'default',
          },
        },
      ],
      openui: [],
    },
  },
];

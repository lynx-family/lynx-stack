// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export interface OpenUIComponentProp {
  name: string;
  type: string;
  description: string;
  default?: string;
}

export interface OpenUIComponentDoc {
  name: string;
  category: string;
  description: string;
  props: OpenUIComponentProp[];
  usage: string;
}

export const OPENUI_CATEGORIES = [
  { id: 'layout', label: 'Layout' },
  { id: 'content', label: 'Content' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'data-display', label: 'Data Display' },
] as const;

export const OPENUI_COMPONENT_CATALOG: OpenUIComponentDoc[] = [
  {
    name: 'Stack',
    category: 'layout',
    description: 'Flex layout container.',
    props: [
      { name: 'children', type: 'any[]', description: 'Child elements.' },
      {
        name: 'direction',
        type: '"row" | "column"',
        description: 'Flex direction.',
        default: '"column"',
      },
      { name: 'wrap', type: 'boolean', description: 'Enable flex-wrap.' },
      {
        name: 'gap',
        type: '"none" | "xs" | "s" | "m" | "l" | "xl"',
        description: 'Gap between children.',
        default: '"m"',
      },
      {
        name: 'align',
        type: '"start" | "center" | "end" | "stretch"',
        description: 'Align items.',
        default: '"stretch"',
      },
      {
        name: 'justify',
        type: '"start" | "center" | "end" | "between"',
        description: 'Justify content.',
        default: '"start"',
      },
    ],
    usage: `root = Stack([title, subtitle], "column", false, "l")
title = TextContent("Hello World", "large-heavy")
subtitle = TextContent("A simple stack example")`,
  },
  {
    name: 'Card',
    category: 'content',
    description: 'Styled container with card/sunk/clear variants.',
    props: [
      { name: 'children', type: 'any[]', description: 'Child elements.' },
      {
        name: 'variant',
        type: '"card" | "sunk" | "clear"',
        description: 'Visual style.',
        default: '"card"',
      },
      {
        name: 'direction',
        type: '"row" | "column"',
        description: 'Flex direction.',
        default: '"column"',
      },
      { name: 'wrap', type: 'boolean', description: 'Enable flex-wrap.' },
      {
        name: 'gap',
        type: '"none" | "xs" | "s" | "m" | "l" | "xl"',
        description: 'Gap between children.',
        default: '"m"',
      },
      {
        name: 'align',
        type: '"start" | "center" | "end" | "stretch"',
        description: 'Align items.',
        default: '"stretch"',
      },
      {
        name: 'justify',
        type: '"start" | "center" | "end" | "between"',
        description: 'Justify content.',
        default: '"start"',
      },
    ],
    usage: `root = Stack([card])
card = Card([header, content])
header = CardHeader("Card Title", "Optional subtitle")
content = TextContent("Card body text goes here.")`,
  },
  {
    name: 'CardHeader',
    category: 'content',
    description: 'Card header with title and optional subtitle.',
    props: [
      { name: 'title', type: 'string', description: 'Header title.' },
      { name: 'subtitle', type: 'string', description: 'Optional subtitle.' },
    ],
    usage: `root = Stack([Card([CardHeader("Main Title", "Subtitle text")])])`,
  },
  {
    name: 'TextContent',
    category: 'content',
    description: 'Text content with optional size.',
    props: [
      {
        name: 'text',
        type: 'string | number | boolean',
        description: 'Text to display.',
      },
      {
        name: 'size',
        type: '"small" | "default" | "large" | "small-heavy" | "large-heavy"',
        description: 'Text size.',
        default: '"default"',
      },
    ],
    usage: `root = Stack([t1, t2, t3])
t1 = TextContent("Small text", "small")
t2 = TextContent("Default text")
t3 = TextContent("Large heavy text", "large-heavy")`,
  },
  {
    name: 'Separator',
    category: 'content',
    description: 'Horizontal separator line.',
    props: [],
    usage:
      `root = Stack([TextContent("Above"), Separator(), TextContent("Below")])`,
  },
  {
    name: 'Button',
    category: 'buttons',
    description: 'Clickable button with action support.',
    props: [
      { name: 'label', type: 'string', description: 'Button label text.' },
      {
        name: 'action',
        type: 'ActionPlan | LegacyAction',
        description: 'Action to trigger on click.',
      },
      {
        name: 'variant',
        type: '"primary" | "secondary" | "tertiary"',
        description: 'Button style.',
        default: '"primary"',
      },
      {
        name: 'type',
        type: '"normal" | "destructive"',
        description: 'Button type.',
      },
      {
        name: 'size',
        type: '"extra-small" | "small" | "medium" | "large"',
        description: 'Button size.',
      },
    ],
    usage: `root = Stack([buttons])
buttons = Buttons([btn1, btn2, btn3])
btn1 = Button("Primary", Action([@ToAssistant("Clicked primary")]), "primary")
btn2 = Button("Secondary", Action([@ToAssistant("Clicked secondary")]), "secondary")
btn3 = Button("Tertiary", Action([@ToAssistant("Clicked tertiary")]), "tertiary")`,
  },
  {
    name: 'Buttons',
    category: 'buttons',
    description: 'Button group container.',
    props: [
      {
        name: 'buttons',
        type: 'Button[]',
        description: 'Array of Button components.',
      },
    ],
    usage: `root = Stack([buttons])
buttons = Buttons([Button("OK", Action([@ToAssistant("ok")]), "primary"), Button("Cancel", Action([@ToAssistant("cancel")]), "secondary")])`,
  },
  {
    name: 'Tag',
    category: 'data-display',
    description: 'Inline tag / badge.',
    props: [
      { name: 'text', type: 'string', description: 'Tag text.' },
    ],
    usage:
      `root = Stack([Tag("Breaking"), Tag("Politics"), Tag("World")], "row", true, "s")`,
  },
];

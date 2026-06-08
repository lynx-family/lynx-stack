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
  { id: 'inputs', label: 'Inputs' },
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
  {
    name: 'Image',
    category: 'data-display',
    description: 'Image with fit mode and variant sizing.',
    props: [
      { name: 'url', type: 'string', description: 'Image URL or path.' },
      {
        name: 'fit',
        type: '"contain" | "cover" | "fill" | "none" | "scale-down"',
        description: 'How the image fits its frame.',
        default: '"cover"',
      },
      {
        name: 'variant',
        type:
          '"icon" | "avatar" | "smallFeature" | "mediumFeature" | "largeFeature" | "header"',
        description: 'Size variant for the image.',
        default: '"mediumFeature"',
      },
    ],
    usage: `root = Stack([avatar, header, feature])
avatar = Image("https://example.com/avatar.png", "cover", "avatar")
header = Image("https://example.com/banner.png", "cover", "header")
feature = Image("https://example.com/hero.png", "contain", "largeFeature")`,
  },
  {
    name: 'Icon',
    category: 'data-display',
    description: 'Material icon ligature. Font is loaded via renderer.css.',
    props: [
      {
        name: 'name',
        type:
          '"account_circle" | "add" | "arrow_back" | "arrow_forward" | "camera" | "check" | "close" | "delete" | "edit" | "error" | "favorite" | "help" | "home" | "info" | "location_on" | "lock" | "mail" | "menu" | "more_vert" | "pause" | "person" | "play_arrow" | "refresh" | "search" | "send" | "settings" | "share" | "star" | "warning"',
        description: 'Material icon ligature name.',
      },
      {
        name: 'size',
        type: '"sm" | "md" | "lg"',
        description: 'Icon size.',
        default: '"md"',
      },
      {
        name: 'color',
        type: '"primary" | "muted" | "inherit"',
        description: 'Icon color.',
        default: '"inherit"',
      },
    ],
    usage: `root = Stack([row])
row = Stack([Icon("check", "md", "primary"), Icon("close", "lg", "muted")], "row", false, "s")`,
  },
  {
    name: 'Loading',
    category: 'data-display',
    description: 'Skeleton placeholder while content loads.',
    props: [
      {
        name: 'variant',
        type: '"inline" | "block"',
        description: 'Visual density of the skeleton.',
        default: '"inline"',
      },
    ],
    usage:
      `root = Stack([Loading("inline"), Loading("block")], "column", false, "m")`,
  },
  {
    name: 'CheckBox',
    category: 'inputs',
    description:
      'Toggleable checkbox. Tap fires the action; visual state is controlled by the caller.',
    props: [
      { name: 'label', type: 'string', description: 'Checkbox label text.' },
      {
        name: 'value',
        type: 'boolean',
        description: 'Whether the box is checked.',
        default: 'false',
      },
      {
        name: 'action',
        type: 'ActionPlan | LegacyAction',
        description: 'Action fired on tap.',
      },
    ],
    usage: `root = Stack([box1, box2])
box1 = CheckBox("I agree to the terms", true, Action([@ToAssistant("Agree")]))
box2 = CheckBox("Subscribe to updates", false, Action([@ToAssistant("Subscribe")]))`,
  },
  {
    name: 'RadioGroup',
    category: 'inputs',
    description: 'Single-choice radio group. Tap fires the action.',
    props: [
      {
        name: 'items',
        type: 'string[]',
        description: 'The list of options to display.',
      },
      {
        name: 'value',
        type: 'string',
        description: 'Currently selected option.',
      },
      {
        name: 'usageHint',
        type: '"default" | "card" | "row"',
        description: 'Visual layout for the group.',
        default: '"default"',
      },
      {
        name: 'action',
        type: 'ActionPlan | LegacyAction',
        description: 'Action fired on selection change.',
      },
    ],
    usage: `root = Stack([rg])
rg = RadioGroup(["Small", "Medium", "Large"], "Medium", "row", Action([@ToAssistant("size")]))`,
  },
  {
    name: 'Slider',
    category: 'inputs',
    description: 'Continuous-value slider. Drag fires the action.',
    props: [
      {
        name: 'label',
        type: 'string',
        description: 'Label shown next to the slider.',
      },
      {
        name: 'min',
        type: 'number',
        description: 'Minimum value.',
        default: '0',
      },
      {
        name: 'max',
        type: 'number',
        description: 'Maximum value.',
        default: '100',
      },
      { name: 'value', type: 'number', description: 'Current value.' },
      {
        name: 'step',
        type: 'number',
        description: 'Step interval for snapping.',
      },
      {
        name: 'action',
        type: 'ActionPlan | LegacyAction',
        description: 'Action fired on value change.',
      },
    ],
    usage: `root = Stack([s1, s2])
s1 = Slider("Volume", 0, 100, 50, 1, Action([@ToAssistant("volume")]))
s2 = Slider("Brightness", 0, 100, 75, 5, Action([@ToAssistant("brightness")]))`,
  },
  {
    name: 'TextField',
    category: 'inputs',
    description:
      'Text input with variants for short text, number, obscured, and long text.',
    props: [
      { name: 'label', type: 'string', description: 'Field label.' },
      { name: 'value', type: 'string', description: 'Current text value.' },
      {
        name: 'variant',
        type: '"shortText" | "number" | "obscured" | "longText"',
        description: 'Input variant.',
        default: '"shortText"',
      },
      {
        name: 'validationRegexp',
        type: 'string',
        description: 'Regex used for client-side validation.',
      },
      {
        name: 'action',
        type: 'ActionPlan | LegacyAction',
        description: 'Action fired on each keystroke.',
      },
    ],
    usage: `root = Stack([tf1, tf2, tf3])
tf1 = TextField("Email", "user@example.com", "shortText", "", Action([@ToAssistant("email")]))
tf2 = TextField("Age", "30", "number", "", Action([@ToAssistant("age")]))
tf3 = TextField("Notes", "Hello", "longText", "", Action([@ToAssistant("notes")]))`,
  },
];

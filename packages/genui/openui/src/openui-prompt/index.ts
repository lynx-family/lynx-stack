// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  createLibrary,
  defineComponent,
  tagSchemaId,
} from '@openuidev/lang-core';
import type {
  ComponentGroup,
  DefinedComponent,
  Library,
  PromptOptions,
} from '@openuidev/lang-core';
import { z } from 'zod/v4';

type HeadlessRenderer = () => null;

export type OpenUiPromptComponent = DefinedComponent<any, HeadlessRenderer>;
export type OpenUiPromptLibrary = Library<HeadlessRenderer>;

/**
 * Options for creating the headless OpenUI prompt library.
 */
export interface CreateOpenUiPromptLibraryOptions {
  /** Override the root component name. Defaults to `'Stack'`. */
  root?: string;
  /** Replace or extend the built-in component set. */
  components?: OpenUiPromptComponent[];
  /** Replace or extend the built-in component groups. */
  componentGroups?: ComponentGroup[];
}

/**
 * Options used to customize the generated OpenUI system prompt.
 */
export interface BuildOpenUiSystemPromptOptions
  extends CreateOpenUiPromptLibraryOptions
{
  promptOptions?: PromptOptions;
  appendix?: string;
}

const ICON_NAMES = [
  'account_circle',
  'add',
  'arrow_back',
  'arrow_forward',
  'camera',
  'check',
  'close',
  'delete',
  'edit',
  'error',
  'favorite',
  'help',
  'home',
  'info',
  'location_on',
  'lock',
  'mail',
  'menu',
  'more_vert',
  'pause',
  'person',
  'play_arrow',
  'refresh',
  'search',
  'send',
  'settings',
  'share',
  'star',
  'warning',
] as const;

const GAP_VALUES = ['none', 'xs', 's', 'm', 'l', 'xl'] as const;
const ALIGN_VALUES = ['start', 'center', 'end', 'stretch'] as const;
const STACK_JUSTIFY_VALUES = ['start', 'center', 'end', 'between'] as const;
const EXTENDED_JUSTIFY_VALUES = [
  'start',
  'center',
  'end',
  'between',
  'around',
  'evenly',
  'spaceBetween',
  'spaceAround',
  'spaceEvenly',
  'stretch',
] as const;
const TEXT_VARIANTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'caption',
  'body',
] as const;

const pathBindingSchema = z.object({
  path: z.string(),
});
tagSchemaId(pathBindingSchema, 'PathBinding');

const stringLikeSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  pathBindingSchema,
]);
tagSchemaId(stringLikeSchema, 'StringLike');

const booleanLikeSchema = z.union([
  z.boolean(),
  pathBindingSchema,
]);
tagSchemaId(booleanLikeSchema, 'BooleanLike');

const templateChildrenSchema = z.object({
  componentId: z.string(),
  path: z.string(),
});
tagSchemaId(templateChildrenSchema, 'TemplateChildren');

const listChildrenSchema = z.union([
  z.array(z.any()),
  templateChildrenSchema,
]);

const actionStepSchema = z.looseObject({
  type: z.string(),
});

const actionPlanSchema = z.object({
  steps: z.array(actionStepSchema),
});

const legacyActionSchema = z.object({
  type: z.string().optional(),
  params: z.record(z.string(), z.any()).optional(),
  url: z.string().optional(),
  context: z.string().optional(),
});

/** Shared action prop schema exposed to prompt signatures as `ActionExpression`. */
export const openUiPromptActionPropSchema = z.union([
  actionPlanSchema,
  legacyActionSchema,
]);
tagSchemaId(openUiPromptActionPropSchema, 'ActionExpression');

const Stack = defineComponent({
  name: 'Stack',
  props: z.object({
    children: z.array(z.any()),
    direction: z.enum(['row', 'column']).optional(),
    wrap: z.boolean().optional(),
    gap: z.enum(GAP_VALUES).optional(),
    align: z.enum(ALIGN_VALUES).optional(),
    justify: z.enum(STACK_JUSTIFY_VALUES).optional(),
  }),
  description: 'Flex layout container.',
  component: () => null,
});

const Row = defineComponent({
  name: 'Row',
  props: z.object({
    children: z.array(z.any()),
    justify: z.enum(EXTENDED_JUSTIFY_VALUES).optional(),
    align: z.enum(ALIGN_VALUES).optional(),
    gap: z.enum(GAP_VALUES).optional(),
    wrap: z.boolean().optional(),
  }),
  description: 'Horizontal flex layout container.',
  component: () => null,
});

const Column = defineComponent({
  name: 'Column',
  props: z.object({
    children: z.array(z.any()),
    justify: z.enum(EXTENDED_JUSTIFY_VALUES).optional(),
    align: z.enum(ALIGN_VALUES).optional(),
    gap: z.enum(GAP_VALUES).optional(),
  }),
  description: 'Vertical flex layout container.',
  component: () => null,
});

const List = defineComponent({
  name: 'List',
  props: z.object({
    children: listChildrenSchema.optional(),
    items: listChildrenSchema.optional(),
    direction: z.enum(['vertical', 'horizontal']).optional(),
    align: z.enum(ALIGN_VALUES).optional(),
    gap: z.enum(GAP_VALUES).optional(),
    divider: z.boolean().optional(),
  }),
  description:
    'List container for repeated children. Pass child components as the first argument.',
  component: () => null,
});

const Card = defineComponent({
  name: 'Card',
  props: z.object({
    children: z.array(z.any()),
    variant: z.enum(['card', 'sunk', 'clear']).optional(),
    direction: z.enum(['row', 'column']).optional(),
    wrap: z.boolean().optional(),
    gap: z.enum(GAP_VALUES).optional(),
    align: z.enum(ALIGN_VALUES).optional(),
    justify: z.enum(STACK_JUSTIFY_VALUES).optional(),
  }),
  description:
    'Styled container (card/sunk/clear). Accepts Stack layout parameters.',
  component: () => null,
});

const CardHeader = defineComponent({
  name: 'CardHeader',
  props: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
  }),
  description: 'Card header with title and optional subtitle.',
  component: () => null,
});

const TextContent = defineComponent({
  name: 'TextContent',
  props: z.object({
    text: z.union([z.string(), z.number(), z.boolean()]),
    size: z.enum(['small', 'default', 'large', 'small-heavy', 'large-heavy'])
      .optional(),
  }),
  description: 'Text content with optional size.',
  component: () => null,
});

const Text = defineComponent({
  name: 'Text',
  props: z.object({
    text: stringLikeSchema,
    variant: z.enum(TEXT_VARIANTS).optional(),
  }),
  description:
    'Plain text with semantic variants h1, h2, h3, h4, h5, caption, and body.',
  component: () => null,
});

const Separator = defineComponent({
  name: 'Separator',
  props: z.object({}),
  description: 'Visual separator.',
  component: () => null,
});

const Divider = defineComponent({
  name: 'Divider',
  props: z.object({
    axis: z.enum(['horizontal', 'vertical']).optional(),
  }),
  description: 'Horizontal or vertical divider.',
  component: () => null,
});

const Button = defineComponent({
  name: 'Button',
  props: z.object({
    label: z.string(),
    action: openUiPromptActionPropSchema.optional(),
    variant: z.enum(['primary', 'secondary', 'tertiary']).optional(),
    type: z.enum(['normal', 'destructive']).optional(),
    size: z.enum(['extra-small', 'small', 'medium', 'large']).optional(),
  }),
  description: 'Clickable button.',
  component: () => null,
});

const Buttons = defineComponent({
  name: 'Buttons',
  props: z.object({
    buttons: z.array(Button.ref),
  }),
  description: 'Button group.',
  component: () => null,
});

const Tag = defineComponent({
  name: 'Tag',
  props: z.object({
    text: z.string(),
  }),
  description: 'Compact label or status tag.',
  component: () => null,
});

const Image = defineComponent({
  name: 'Image',
  props: z.object({
    url: stringLikeSchema,
    fit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional(),
    variant: z.enum([
      'icon',
      'avatar',
      'smallFeature',
      'mediumFeature',
      'largeFeature',
      'header',
    ]).optional(),
  }),
  description: 'Image with optional fit and variant sizing.',
  component: () => null,
});

const Icon = defineComponent({
  name: 'Icon',
  props: z.object({
    name: z.enum(ICON_NAMES),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    color: z.enum(['primary', 'muted', 'inherit']).optional(),
  }),
  description: 'Material icon.',
  component: () => null,
});

const Loading = defineComponent({
  name: 'Loading',
  props: z.object({
    variant: z.enum(['inline', 'block']).optional(),
  }),
  description: 'Skeleton placeholder while content loads.',
  component: () => null,
});

const AudioPlayer = defineComponent({
  name: 'AudioPlayer',
  props: z.object({
    url: stringLikeSchema,
    description: stringLikeSchema.optional(),
  }),
  description: 'Audio attachment placeholder with URL and description.',
  component: () => null,
});

const Video = defineComponent({
  name: 'Video',
  props: z.object({
    url: stringLikeSchema,
    title: stringLikeSchema.optional(),
  }),
  description: 'Video attachment placeholder with URL and optional title.',
  component: () => null,
});

const CheckBox = defineComponent({
  name: 'CheckBox',
  props: z.object({
    label: z.string(),
    value: z.boolean().optional(),
    action: openUiPromptActionPropSchema.optional(),
    name: z.string().optional(),
  }),
  description:
    'Toggleable checkbox. Use name when it participates in a form or stateful flow.',
  component: () => null,
});

const RadioGroup = defineComponent({
  name: 'RadioGroup',
  props: z.object({
    items: z.array(z.string()),
    value: z.string().optional(),
    usageHint: z.enum(['default', 'card', 'row']).optional(),
    action: openUiPromptActionPropSchema.optional(),
    name: z.string().optional(),
  }),
  description: 'Single-choice radio group.',
  component: () => null,
});

const ChoicePicker = defineComponent({
  name: 'ChoicePicker',
  props: z.object({
    label: stringLikeSchema.optional(),
    options: z.union([z.array(stringLikeSchema), stringLikeSchema]),
    value: stringLikeSchema.optional(),
    variant: z.enum(['default', 'card']).optional(),
    displayStyle: z.enum(['list', 'chips', 'dropdown']).optional(),
    filterable: booleanLikeSchema.optional(),
  }),
  description:
    'Choice picker rendered as selectable chips, list items, or a dropdown-like field.',
  component: () => null,
});

const Slider = defineComponent({
  name: 'Slider',
  props: z.object({
    label: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    value: z.number().optional(),
    step: z.number().optional(),
    action: openUiPromptActionPropSchema.optional(),
    name: z.string().optional(),
  }),
  description: 'Continuous-value slider.',
  component: () => null,
});

const DateTimeInput = defineComponent({
  name: 'DateTimeInput',
  props: z.object({
    value: stringLikeSchema,
    enableDate: booleanLikeSchema.optional(),
    enableTime: booleanLikeSchema.optional(),
    min: stringLikeSchema.optional(),
    max: stringLikeSchema.optional(),
    label: stringLikeSchema.optional(),
  }),
  description:
    'Date/time value display with optional label, min/max, and enabled date/time hints.',
  component: () => null,
});

const TextField = defineComponent({
  name: 'TextField',
  props: z.object({
    label: z.string(),
    value: z.string().optional(),
    variant: z.enum(['longText', 'number', 'shortText', 'obscured'])
      .optional(),
    validationRegexp: z.string().optional(),
    action: openUiPromptActionPropSchema.optional(),
    name: z.string().optional(),
  }),
  description:
    'Single-line or multi-line text input with optional regex validation.',
  component: () => null,
});

const Modal = defineComponent({
  name: 'Modal',
  props: z.object({
    trigger: z.any(),
    content: z.any(),
    title: stringLikeSchema.optional(),
    closeOnAction: z.boolean().optional(),
  }),
  description:
    'Tap-triggered modal container. Pass the trigger component first and content second.',
  component: () => null,
});

const Tabs = defineComponent({
  name: 'Tabs',
  props: z.object({
    tabs: z.array(z.object({
      value: z.string(),
      title: stringLikeSchema,
      child: z.any(),
    })),
    value: z.string().optional(),
  }),
  description:
    'Tabbed content switcher. Each tab item is an object with value, title, and child.',
  component: () => null,
});

const DEFAULT_COMPONENTS: OpenUiPromptComponent[] = [
  Stack,
  Row,
  Column,
  List,
  Card,
  CardHeader,
  Text,
  TextContent,
  Separator,
  Divider,
  Button,
  Buttons,
  Tag,
  Image,
  Icon,
  Loading,
  AudioPlayer,
  Video,
  CheckBox,
  RadioGroup,
  ChoicePicker,
  Slider,
  DateTimeInput,
  TextField,
  Modal,
  Tabs,
];

const DEFAULT_COMPONENT_GROUPS: ComponentGroup[] = [
  {
    name: 'Layout',
    components: [
      'Stack',
      'Row',
      'Column',
      'List',
      'Tabs',
      'Modal',
      'Separator',
      'Divider',
    ],
  },
  {
    name: 'Content',
    components: ['Card', 'CardHeader', 'Text', 'TextContent'],
  },
  { name: 'Buttons', components: ['Button', 'Buttons'] },
  { name: 'Data Display', components: ['Tag', 'Icon', 'Loading'] },
  { name: 'Media', components: ['Image', 'AudioPlayer', 'Video'] },
  {
    name: 'Inputs',
    components: [
      'CheckBox',
      'RadioGroup',
      'ChoicePicker',
      'Slider',
      'DateTimeInput',
      'TextField',
    ],
  },
];

const DEFAULT_ADDITIONAL_RULES = [
  'Use the built-in OpenUI components exactly as listed; do not invent component names or named-argument syntax.',
  'Prefer compact, mobile-friendly layouts. Use Stack, Row, Column, List, and Card for structure, CardHeader for titles, and Text/TextContent for text.',
  'Use Tabs for alternate views, Modal for tap-to-open details, and List for repeated or grouped items.',
  'For List, pass the child component array as the first argument; only use TemplateChildren when the host provides template data.',
  'For Tabs, each tab entry is an object like { value: "summary", title: "Summary", child: summaryContent }.',
  'For Modal, pass trigger first and content second: Modal(triggerButton, modalContent, "Title").',
  'When no real tool list is provided, use realistic Query() defaults or static data instead of inventing external tool behavior.',
  'Return only OpenUI Lang code unless inlineMode is explicitly enabled.',
];

const DEFAULT_EXAMPLES = [
  [
    'root = Stack([hero, actions], "column", false, "m", "stretch", "start")',
    'hero = Card([CardHeader("Weekly Summary", "Updated just now"), TextContent("Revenue is up 18%.", "large-heavy"), TextContent("Three accounts need follow-up.", "small")], "card", "column", false, "s", "start", "start")',
    'actions = Buttons([Button("Show details", Action([@ToAssistant("Show the account details")]), "primary"), Button("Reset", Action([@Reset($filter)]), "tertiary")])',
  ].join('\n'),
  [
    '$city = "Seattle"',
    'weather = Query("get_weather", { city: $city }, { city: "Seattle", temp: "62", condition: "Cloudy", alerts: [] })',
    'root = Stack([card], "column", false, "m", "stretch", "start")',
    'card = Card([CardHeader("Live Weather", "Query-backed card"), TextContent(weather.city + " - " + weather.condition, "large-heavy"), TextContent(weather.temp + "F"), Buttons([Button("Refresh", Action([@Run(weather)]), "secondary"), Button("Use SF", Action([@Set($city, "San Francisco"), @Run(weather)]), "tertiary")])], "card", "column", false, "s", "start", "start")',
  ].join('\n'),
  [
    'root = Column([header, tabs, media], "start", "stretch", "m")',
    'header = Row([Icon("location_on", "md", "primary"), Text("Trip Plan", "h3")], "start", "center", "s")',
    'tabs = Tabs([{ value: "summary", title: "Summary", child: summary }, { value: "details", title: "Details", child: details }])',
    'summary = Card([CardHeader("Friday", "Downtown route"), TextContent("Three stops, light walking, dinner at 7 PM.")], "card", "column", false, "s")',
    'details = List([Text("Museum tickets confirmed.", "body"), DateTimeInput("2026-07-10T19:00", true, true, "2026-07-10T18:00", "2026-07-10T21:00", "Dinner reservation")])',
    'media = Row([Image("https://example.com/map.png", "cover", "smallFeature"), Video("https://example.com/preview.mp4", "Route preview")], "start", "center", "s", true)',
  ].join('\n'),
  [
    'root = Stack([filters, list, detailsModal], "column", false, "m", "stretch", "start")',
    'filters = ChoicePicker("Priority", ["High", "Normal", "Low"], "Normal", "card", "chips")',
    'list = List([Card([Text("Inbox triage", "h4"), TextContent("12 items need review."), AudioPlayer("https://example.com/briefing.mp3", "Briefing audio")], "card", "column", false, "s")])',
    'detailsModal = Modal(Button("Open details", Action([@ToAssistant("Open inbox details")]), "secondary"), Card([CardHeader("Details"), TextContent("Use actions to confirm or defer items.")]), "Inbox details")',
  ].join('\n'),
];

function withDefaultPromptOptions(options?: PromptOptions): PromptOptions {
  return {
    bindings: true,
    toolCalls: true,
    ...options,
    additionalRules: [
      ...DEFAULT_ADDITIONAL_RULES,
      ...(options?.additionalRules ?? []),
    ],
    examples: options?.examples ?? DEFAULT_EXAMPLES,
  };
}

/**
 * Create a headless OpenUI library with the built-in component schemas.
 *
 * This mirrors the ReactLynx library for prompt generation while avoiding any
 * runtime dependency on ReactLynx or Lynx UI components.
 */
export function createOpenUiPromptLibrary(
  options: CreateOpenUiPromptLibraryOptions = {},
): OpenUiPromptLibrary {
  return createLibrary<HeadlessRenderer>({
    root: options.root ?? 'Stack',
    components: options.components
      ? [...DEFAULT_COMPONENTS, ...options.components]
      : DEFAULT_COMPONENTS,
    componentGroups: options.componentGroups
      ? [...DEFAULT_COMPONENT_GROUPS, ...options.componentGroups]
      : DEFAULT_COMPONENT_GROUPS,
  });
}

/**
 * Build the full OpenUI system prompt for the supplied library and options.
 */
export function buildOpenUiSystemPrompt(
  options: BuildOpenUiSystemPromptOptions = {},
): string {
  const libraryOptions: CreateOpenUiPromptLibraryOptions = {};
  if (options.root !== undefined) {
    libraryOptions.root = options.root;
  }
  if (options.components !== undefined) {
    libraryOptions.components = options.components;
  }
  if (options.componentGroups !== undefined) {
    libraryOptions.componentGroups = options.componentGroups;
  }
  const library = createOpenUiPromptLibrary(libraryOptions);
  const prompt = library.prompt(
    withDefaultPromptOptions(options.promptOptions),
  );
  return options.appendix ? `${prompt}\n\n${options.appendix}` : prompt;
}

export const OPENUI_SYSTEM_PROMPT: string = buildOpenUiSystemPrompt();

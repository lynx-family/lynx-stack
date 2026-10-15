// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @module prompt
 */

import { createLibrary } from '@openuidev/lang-core';
import type {
  ComponentGroup,
  DefinedComponent,
  Library,
  PromptOptions,
} from '@openuidev/lang-core';

import {
  AudioPlayer,
  Button,
  Buttons,
  Canvas,
  Card,
  CardHeader,
  CheckBox,
  ChoicePicker,
  Column,
  DateTimeInput,
  Divider,
  Icon,
  Image,
  List,
  Loading,
  Modal,
  RadioGroup,
  Row,
  Separator,
  Slider,
  Stack,
  Tabs,
  Tag,
  Text,
  TextContent,
  TextField,
  Video,
} from '../catalog/agent.js';
import { DATA_GENERATION_RULES } from '../data-tools/data-rules.js';
import { registerOpenUIBuiltins } from '../shared/builtins.js';

/** Shared action prop schema exposed to prompt signatures as `ActionExpression`. */
export { actionPropSchema as openUiPromptActionPropSchema } from '../catalog/Action/schema.js';

type HeadlessRenderer = () => null;

export type OpenUiPromptComponent = DefinedComponent<any, HeadlessRenderer>;
export type OpenUiPromptLibrary = Library<HeadlessRenderer>;

/**
 * Options for creating the headless OpenUI prompt library.
 */
export interface CreateOpenUiPromptLibraryOptions {
  /** Override the root component name. Defaults to `'Stack'`. */
  root?: string;
  /** Limit built-ins to these names. Custom `components` are still appended. */
  componentNames?: readonly string[];
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

const DEFAULT_COMPONENTS: OpenUiPromptComponent[] = [
  Stack,
  Row,
  Column,
  List,
  Canvas,
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
  { name: 'Media', components: ['Image', 'Canvas', 'AudioPlayer', 'Video'] },
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

const ENUM_ARGUMENT_RULE =
  'Treat every component enum as a closed set: use only the exact values listed for that argument. Do not borrow enum values from another component or from the broader upstream UI or icon library. If no value fits, use another available component instead of inventing a value.';

const DEFAULT_ADDITIONAL_RULES = [
  'Use the built-in OpenUI components exactly as listed; do not invent component names or named-argument syntax.',
  'Arguments are positional. Omit optional arguments only from the end; use null for every skipped optional slot before a later argument. Never shift later values into earlier slots.',
  ENUM_ARGUMENT_RULE,
  'Prefer compact, mobile-friendly layouts. Use Stack, Row, Column, List, and Card for structure, CardHeader for titles, and Text/TextContent for text.',
  'Use Tabs for alternate views, Modal for tap-to-open details, and List for repeated or grouped items.',
  'For List, use List(children, null, direction, align, gap, divider) when supplying layout options; the second items argument must remain null when children is supplied. Only use TemplateChildren when the host provides template data.',
  'For Tabs, each tab entry is an object like { value: "summary", title: "Summary", child: summaryContent }.',
  'For Modal, pass trigger first and content second: Modal(triggerButton, modalContent, "Title").',
  'When no real tool list is provided, use realistic Query() defaults or static data instead of inventing external tool behavior.',
  'Use media URLs only when supplied by the user or host or returned by a host image tool. Never invent placeholder URLs. Use Icon or text when no image is available.',
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
    'details = List([Text("Museum tickets confirmed.", "body"), DateTimeInput("2026-07-10T19:00", true, true, "2026-07-10T18:00", "2026-07-10T21:00", "Dinner reservation")], null, "vertical", "stretch", "s", false)',
    'media = Row([Icon("location_on", "md", "primary"), Text("Downtown walking route", "body")], "start", "center", "s", true)',
  ].join('\n'),
  [
    'root = Stack([filters, list, detailsModal], "column", false, "m", "stretch", "start")',
    'filters = ChoicePicker("Priority", ["High", "Normal", "Low"], "Normal", "card", "chips")',
    'list = List([Card([Text("Inbox triage", "h4"), TextContent("12 items need review."), TextContent("Briefing audio is unavailable.")], "card", "column", false, "s")])',
    'detailsModal = Modal(Button("Open details", Action([@ToAssistant("Open inbox details")]), "secondary"), Card([CardHeader("Details"), TextContent("Use actions to confirm or defer items.")]), "Inbox details")',
  ].join('\n'),
];

const RESTRICTED_COMPONENT_RULES = [
  'Use only the components listed in this prompt; do not invent component names or named-argument syntax.',
  'Arguments are positional. Omit optional arguments only from the end; use null for every skipped optional slot before a later argument. Never shift later values into earlier slots.',
  ENUM_ARGUMENT_RULE,
  'Prefer compact, mobile-friendly layouts built from the available layout and content components.',
  'Return only OpenUI Lang code unless inlineMode is explicitly enabled.',
];

function withDefaultPromptOptions(
  options?: PromptOptions,
  restrictedComponents = false,
): PromptOptions {
  const defaultRules = restrictedComponents
    ? RESTRICTED_COMPONENT_RULES
    : DEFAULT_ADDITIONAL_RULES;
  const toolNames = new Set(
    options?.tools?.map(tool => typeof tool === 'string' ? tool : tool.name),
  );
  const dataRules = (options?.toolCalls ?? !restrictedComponents)
      && toolNames.has('openui_query') && toolNames.has('openui_mutation')
    ? [DATA_GENERATION_RULES]
    : [];
  return {
    bindings: true,
    toolCalls: !restrictedComponents,
    ...options,
    additionalRules: [
      ...defaultRules,
      ...dataRules,
      ...(options?.additionalRules ?? []),
    ],
    examples: options?.examples
      ?? (restrictedComponents ? [] : DEFAULT_EXAMPLES),
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
  registerOpenUIBuiltins();
  const root = options.root ?? 'Stack';
  const componentNames = options.componentNames
    ? new Set([...options.componentNames, root])
    : null;
  const defaultComponents = componentNames
    ? DEFAULT_COMPONENTS.filter((component) =>
      componentNames.has(component.name)
    )
    : DEFAULT_COMPONENTS;
  const defaultComponentGroups = componentNames
    ? DEFAULT_COMPONENT_GROUPS
      .map((group) => ({
        ...group,
        components: group.components.filter((name) => componentNames.has(name)),
      }))
      .filter((group) => group.components.length > 0)
    : DEFAULT_COMPONENT_GROUPS;

  return createLibrary<HeadlessRenderer>({
    root,
    components: options.components
      ? [...defaultComponents, ...options.components]
      : defaultComponents,
    componentGroups: options.componentGroups
      ? [...defaultComponentGroups, ...options.componentGroups]
      : defaultComponentGroups,
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
  if (options.componentNames !== undefined) {
    libraryOptions.componentNames = options.componentNames;
  }
  if (options.components !== undefined) {
    libraryOptions.components = options.components;
  }
  if (options.componentGroups !== undefined) {
    libraryOptions.componentGroups = options.componentGroups;
  }
  const library = createOpenUiPromptLibrary(libraryOptions);
  const prompt = library.prompt(
    withDefaultPromptOptions(
      options.promptOptions,
      options.componentNames !== undefined,
    ),
  );
  return options.appendix ? `${prompt}\n\n${options.appendix}` : prompt;
}

export const OPENUI_SYSTEM_PROMPT: string = buildOpenUiSystemPrompt();

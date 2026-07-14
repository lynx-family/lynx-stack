# Lynx OpenUI Component Catalog

Use these built-in component signatures exactly. Arguments are positional;
`?` marks a trailing optional argument.

## Shared Types

- `gap`: `"none" | "xs" | "s" | "m" | "l" | "xl"`
- `align`: `"start" | "center" | "end" | "stretch"`
- `StringLike`: string, number, boolean, or a host-supported legacy
  `{ path: string }` binding. Prefer v0.5 expressions and `$state` over legacy
  path objects.
- `BooleanLike`: boolean or a host-supported legacy `{ path: string }`
  binding.
- `ActionExpression`: `Action([@step, ...])` or a host-supplied legacy action
  object. Prefer `Action` plans.

## Layout

- `Stack(children, direction?, wrap?, gap?, align?, justify?)`
- `Row(children, justify?, align?, gap?, wrap?)`
- `Column(children, justify?, align?, gap?)`
- `List(children?, items?, direction?, align?, gap?, divider?)`
- `Tabs(tabs, value?)`
- `Modal(trigger, content, title?, closeOnAction?)`
- `Separator()`
- `Divider(axis?)`

Allowed layout values:

- `Stack.direction`: `"row" | "column"`
- `Stack.justify`: `"start" | "center" | "end" | "between"`
- `Row` and `Column` justify: `"start" | "center" | "end" | "between" |
  "around" | "evenly" | "spaceBetween" | "spaceAround" | "spaceEvenly" |
  "stretch"`
- `List.direction`: `"vertical" | "horizontal"`
- `Divider.axis`: `"horizontal" | "vertical"`
- Each `Tabs` item: `{ value: "id", title: "Title", child: componentRef }`

For the built-in `List`, pass children as the first argument and normally omit
the remaining arguments. The second position is the `items` alias, not
`direction`. Use `@Each` for live repeated data. Built-in `TemplateChildren`
currently renders a diagnostic hint rather than expanding content.

## Content

- `Card(children, variant?, direction?, wrap?, gap?, align?, justify?)`
- `CardHeader(title, subtitle?)`
- `Text(text, variant?)`
- `TextContent(text, size?)`

Allowed content values:

- `Card.variant`: `"card" | "sunk" | "clear"`
- `Text.variant`: `"h1" | "h2" | "h3" | "h4" | "h5" | "caption" |
  "body"`
- `TextContent.size`: `"small" | "default" | "large" | "small-heavy" |
  "large-heavy"`

## Buttons

- `Button(label, action?, variant?, type?, size?)`
- `Buttons(buttons)`

Allowed button values:

- `variant`: `"primary" | "secondary" | "tertiary"`
- `type`: `"normal" | "destructive"`
- `size`: `"extra-small" | "small" | "medium" | "large"`

A button without an action sends its label to the assistant. Use `Buttons`
for a button group.

## Data Display

- `Tag(text)`
- `Icon(name, size?, color?)`
- `Loading(variant?)`

Allowed values:

- `Icon.name`: `"account_circle" | "add" | "arrow_back" |
  "arrow_forward" | "camera" | "check" | "close" | "delete" | "edit" |
  "error" | "favorite" | "help" | "home" | "info" | "location_on" |
  "lock" | "mail" | "menu" | "more_vert" | "pause" | "person" |
  "play_arrow" | "refresh" | "search" | "send" | "settings" | "share" |
  "star" | "warning"`
- `Icon.size`: `"sm" | "md" | "lg"`
- `Icon.color`: `"primary" | "muted" | "inherit"`
- `Loading.variant`: `"inline" | "block"`

## Media

- `Image(url, fit?, variant?)`
- `AudioPlayer(url, description?)`
- `Video(url, title?)`

Allowed image values:

- `fit`: `"contain" | "cover" | "fill" | "none" | "scale-down"`
- `variant`: `"icon" | "avatar" | "smallFeature" | "mediumFeature" |
  "largeFeature" | "header"`

Use a supplied URL. Prefer an explicit image variant; the Lynx implementation
maps variants to concrete dimensions.

## Inputs

- `CheckBox(label, value?, action?, name?)`
- `RadioGroup(items, value?, usageHint?, action?, name?)`
- `ChoicePicker(label?, options, value?, variant?, displayStyle?, filterable?)`
- `Slider(label?, min?, max?, value?, step?, action?, name?)`
- `DateTimeInput(value, enableDate?, enableTime?, min?, max?, label?)`
- `TextField(label, value?, variant?, validationRegexp?, action?, name?)`

Allowed input values:

- `RadioGroup.usageHint`: `"default" | "card" | "row"`
- `ChoicePicker.variant`: `"default" | "card"`
- `ChoicePicker.displayStyle`: `"list" | "chips" | "dropdown"`
- `TextField.variant`: `"longText" | "number" | "shortText" | "obscured"`

Current Lynx runtime boundaries:

- `CheckBox`, `RadioGroup`, `Slider`, and `TextField` persist host form state
  when given `name`; their action fires on value change.
- `ChoicePicker` keeps selection only inside the component and has no `name` or
  action prop. Do not use it as a live `Query` filter.
- `DateTimeInput` currently displays a date/time value; do not promise editable
  date picking.
- Put mutations on explicit submit or confirmation buttons, not change actions.

## Unsupported Unless Extended By The Host

Do not emit `Form`, `Input`, `Select`, `SelectItem`, `FormControl`, tables,
charts, or any other name absent from the signatures above unless the caller
provides its exact custom schema.

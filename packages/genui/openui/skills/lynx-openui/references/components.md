# Lynx OpenUI Component Catalog

## Contents

- [Shared Types](#shared-types)
- [Layout](#layout)
- [Content](#content)
- [Buttons](#buttons)
- [Data Display](#data-display)
- [Media](#media)
- [Inputs](#inputs)
- [Unsupported Components](#unsupported-unless-extended-by-the-host)

Use these built-in component signatures exactly. Arguments are positional and
`?` marks a schema-optional argument. Omit an optional argument only when every
later argument is also omitted. If an optional argument precedes a required
one, supply it so later positions do not shift. The signatures include exact
argument types and allowed enum values.

<!-- catalog-json-schema-sha256: 271b241a6bb56e11797ee0013bfc4b5bafe3a32deed58b8e9b1ac1f1d4dc154e -->

## Shared Types

- `StringLike`: string, number, boolean, or a v0.5 expression that resolves to
  one of those primitive values. Although the compatibility schema accepts
  legacy object bindings, generated programs must not use them because the
  built-in Lynx renderer does not resolve them.
- `BooleanLike`: boolean or a v0.5 expression that resolves to boolean. Do not
  generate legacy path objects.
- `ActionExpression`: `Action([@step, ...])` or a host-supplied legacy action
  object. Prefer `Action` plans.

## Layout

- `Stack(children: any[], direction?: "row" | "column", wrap?: boolean, gap?: "none" | "xs" | "s" | "m" | "l" | "xl", align?: "start" | "center" | "end" | "stretch", justify?: "start" | "center" | "end" | "between")`
- `Row(children: any[], justify?: "start" | "center" | "end" | "between" | "around" | "evenly" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch", align?: "start" | "center" | "end" | "stretch", gap?: "none" | "xs" | "s" | "m" | "l" | "xl", wrap?: boolean)`
- `Column(children: any[], justify?: "start" | "center" | "end" | "between" | "around" | "evenly" | "spaceBetween" | "spaceAround" | "spaceEvenly" | "stretch", align?: "start" | "center" | "end" | "stretch", gap?: "none" | "xs" | "s" | "m" | "l" | "xl")`
- `List(children?: any[] | TemplateChildren, items?: any[] | TemplateChildren, direction?: "vertical" | "horizontal", align?: "start" | "center" | "end" | "stretch", gap?: "none" | "xs" | "s" | "m" | "l" | "xl", divider?: boolean)`
- `Separator()`
- `Divider(axis?: "horizontal" | "vertical")`
- `Modal(trigger: any, content: any, title?: StringLike, closeOnAction?: boolean)`
- `Tabs(tabs: {value: string, title: StringLike, child: any}[], value?: string)`

For the built-in `List`, pass children as the first argument and normally omit
the remaining arguments. The second position is the `items` alias, not
`direction`. Use `@Each` for live repeated data. Built-in `TemplateChildren`
currently renders a diagnostic hint rather than expanding content.

## Content

- `Card(children: any[], variant?: "card" | "sunk" | "clear", direction?: "row" | "column", wrap?: boolean, gap?: "none" | "xs" | "s" | "m" | "l" | "xl", align?: "start" | "center" | "end" | "stretch", justify?: "start" | "center" | "end" | "between")`
- `CardHeader(title: string, subtitle?: string)`
- `Text(text: StringLike, variant?: "h1" | "h2" | "h3" | "h4" | "h5" | "caption" | "body")`
- `TextContent(text: string | number | boolean, size?: "small" | "default" | "large" | "small-heavy" | "large-heavy")`

`Text.text` uses `StringLike`. `TextContent.text` accepts only a string, number,
boolean, or an expression that resolves to one of those primitives. Never pass
an object binding to `TextContent`.

## Buttons

- `Button(label: string, action?: ActionExpression, variant?: "primary" | "secondary" | "tertiary", type?: "normal" | "destructive", size?: "extra-small" | "small" | "medium" | "large")`
- `Buttons(buttons: Button[])`

A button without an action sends its label to the assistant. Use `Buttons`
for a button group.

## Data Display

- `Tag(text: string)`
- `Icon(name: "account_circle" | "add" | "arrow_back" | "arrow_forward" | "camera" | "check" | "close" | "delete" | "edit" | "error" | "favorite" | "help" | "home" | "info" | "location_on" | "lock" | "mail" | "menu" | "more_vert" | "pause" | "person" | "play_arrow" | "refresh" | "search" | "send" | "settings" | "share" | "star" | "warning", size?: "sm" | "md" | "lg", color?: "primary" | "muted" | "inherit")`
- `Loading(variant?: "inline" | "block")`

## Media

- `Image(url: StringLike, fit?: "contain" | "cover" | "fill" | "none" | "scale-down", variant?: "icon" | "avatar" | "smallFeature" | "mediumFeature" | "largeFeature" | "header")`
- `AudioPlayer(url: StringLike, description?: StringLike)`
- `Video(url: StringLike, title?: StringLike)`

Use a supplied URL. Prefer an explicit image variant; the Lynx implementation
maps variants to concrete dimensions.

## Inputs

- `CheckBox(label: string, value?: boolean, action?: ActionExpression, name?: string)`
- `RadioGroup(items: string[], value?: string, usageHint?: "default" | "card" | "row", action?: ActionExpression, name?: string)`
- `ChoicePicker(label?: StringLike, options: (StringLike)[] | StringLike, value?: StringLike, variant?: "default" | "card", displayStyle?: "list" | "chips" | "dropdown", filterable?: BooleanLike)`
- `Slider(label?: string, min?: number, max?: number, value?: number, step?: number, action?: ActionExpression, name?: string)`
- `DateTimeInput(value: StringLike, enableDate?: BooleanLike, enableTime?: BooleanLike, min?: StringLike, max?: StringLike, label?: StringLike)`
- `TextField(label: string, value?: string, variant?: "longText" | "number" | "shortText" | "obscured", validationRegexp?: string, action?: ActionExpression, name?: string)`

`ChoicePicker.label` is schema-optional but precedes required `options`. Since
OpenUI Lang calls are positional, always pass a label so `options` remains the
second argument.

Current Lynx runtime boundaries:

- `CheckBox`, `RadioGroup`, `Slider`, and `TextField` persist host form state
  when given `name`; their action fires on value change.
- To bind one of those inputs to `$state`, pass the exact state key including
  `$` as its literal `name`, for example `"$city"`. See
  [runtime.md](runtime.md#state).
- `ChoicePicker` keeps selection only inside the component and has no `name` or
  action prop. Do not use it as a live `Query` filter.
- `DateTimeInput` currently displays a date/time value; do not promise editable
  date picking.
- Put mutations on explicit submit or confirmation buttons, not change actions.

## Unsupported Unless Extended By The Host

Do not emit `Form`, `Input`, `Select`, `SelectItem`, `FormControl`, tables,
charts, or any other name absent from the signatures above unless the caller
provides its exact custom schema.

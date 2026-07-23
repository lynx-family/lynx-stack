# OpenUI Lang v0.5 Runtime

Consult this reference for state, tool-backed data, actions, expressions, repeated
data, or incremental edits.

## Contents

- [Program And Expressions](#program-and-expressions)
- [State](#state)
- [Query](#query)
- [Mutation](#mutation)
- [Actions](#actions)
- [Data Built-ins](#data-built-ins)
- [Streaming And Edits](#streaming-and-edits)

## Program And Expressions

- Write one `identifier = Expression` statement per line.
- In a complete program, define `root = Stack(...)` first. Forward references
  are allowed. An edit-mode patch may omit `root`.
- Use double-quoted strings, numbers, booleans, `null`, arrays, objects,
  component calls, and ordinary references.
- Access fields and indices with `data.rows`, `rows[0]`, and
  `data.rows.title` (array pluck).
- Use arithmetic `+ - * / %`, comparisons `== != > < >= <=`, logic `&& || !`,
  ternaries `condition ? yes : no`, and parentheses.
- Keep every ordinary declaration reachable from `root`. Unreachable
  declarations are orphaned and do not render.

## State

Declare mutable state with a `$` prefix:

```openui
$city = "Seattle"
```

Use simple string, number, or boolean defaults. Undeclared `$variables` may be
auto-created as `null`, but explicit defaults make rendering and reset behavior
predictable. Use `$variables` in expressions, tool arguments, `@Set`, and
`@Reset`.

Built-in Lynx inputs write their `name` into the runtime state store. To bind an
input directly to a `$variable`, pass the variable as its value and pass the
exact variable name, including `$`, as the literal `name` argument:

```openui
$city = "Seattle"
weather = Query("get_weather", { city: $city }, { city: "Seattle", temp: 62 })
cityInput = TextField("City", $city, "shortText", ".+", null, "$city")
```

Here `null` fills the unused action position so `"$city"` reaches `name`.
Typing writes back to `$city`, so expressions update and dependent queries run
again. Do not use `"city"` and then try to copy its value with `@Set`: input
actions do not expose an event-value variable. Use explicit `@Set` buttons for
fixed choices instead.

This same-key binding requires the v0.5 `response` runtime and no enclosing
custom `Form`; a form writes the value into nested form state instead. Each
input event updates the state immediately, without debounce or validation
gating, so use a text-driven `Query` only when live requests on each change are
acceptable.

## Query

Use an actual read tool supplied by the caller or host:

```openui
weather = Query("get_weather", { city: $city }, { city: "Seattle", temp: 62, alerts: [] }, 30)
```

Arguments are tool name, arguments object, immediate default result, and an
optional refresh interval in seconds. Use an ordinary identifier such as
`weather`, not `$weather`.

- Match defaults to the real result shape and keep them compact.
- Read results with field access, index access, array pluck, or built-ins.
- Changing a referenced `$variable` re-runs the query.
- Use `@Run(weather)` for manual refresh.
- Do not turn tool results into manually copied static component statements.

## Mutation

Declare a write tool without executing it:

```openui
save = Mutation("save_preference", { priority: $priority })
```

Execute it only from `@Run(save)` in a visible action. Use `save.status`,
`save.data`, and `save.error` for feedback. Status is `"idle"`, `"loading"`,
`"success"`, or `"error"`.

## Actions

Use `Action([@step, ...])`. Steps run in order:

- `@Run(queryOrMutation)` executes a mutation or refreshes a query.
- `@ToAssistant("message")` continues the conversation.
- `@OpenUrl("https://...")` asks the host to navigate.
- `@Set($variable, value)` updates state.
- `@Reset($var1, $var2, ...)` restores declared defaults.

If a mutation fails, later steps do not run. Put a mutation before dependent
refresh/reset steps only when that halt behavior is intended.

## Data Built-ins

Use only these built-ins:

- `@Count(array)`, `@First(array)`, `@Last(array)`
- `@Sum(numbers)`, `@Avg(numbers)`, `@Min(numbers)`, `@Max(numbers)`
- `@Sort(array, field, direction?)`
- `@Filter(array, field, operator, value)` where operator is `"=="`, `"!="`,
  `">"`, `"<"`, `">="`, `"<="`, or `"contains"`
- `@Round(number, decimals?)`, `@Abs(number)`, `@Floor(number)`, `@Ceil(number)`
- `@Each(array, variableName, inlineTemplate)`

Keep the `@Each` loop variable inside the inline template:

```openui
taskList = List(@Each(tasks.rows, "task", Card([Text(task.title, "h4")])))
```

Do not extract `Card([Text(task.title)])` into another statement because
`task` exists only inside the `@Each` template.

## Streaming And Edits

For complete programs, use this order:

1. `root = Stack(...)`
2. `$state` declarations
3. `Query` and `Mutation` declarations
4. structural component declarations
5. leaf content

The parser resolves forward references as statements stream in. Keep the root
first so the shell appears immediately.

Return a complete program unless the caller explicitly says the host enables
edit mode or merges patches with `mergeStatements`. In edit mode, output only
assignments that must be added or replaced, and include `root` only when the
root graph changes.

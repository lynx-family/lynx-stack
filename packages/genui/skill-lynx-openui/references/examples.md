# Lynx OpenUI Examples

Treat each block as a complete OpenUI program. Adapt component choices and
content to the request.

## Static Card And Conversational Action

```openui
root = Stack([hero, actions], "column", false, "m", "stretch", "start")
hero = Card([CardHeader("Weekly Summary", "Updated just now"), TextContent("Revenue is up 18%.", "large-heavy"), TextContent("Three accounts need follow-up.", "small")], "card", "column", false, "s", "start", "start")
actions = Buttons([Button("Show details", Action([@ToAssistant("Show the account details")]), "primary")])
```

## Local View State

```openui
root = Stack([switcher, content], "column", false, "m", "stretch", "start")
$view = "summary"
switcher = Buttons([Button("Summary", Action([@Set($view, "summary")]), "primary"), Button("Details", Action([@Set($view, "details")]), "secondary")])
content = $view == "summary" ? summary : details
summary = Card([CardHeader("Summary"), TextContent("Three tasks are on track.")], "card", "column", false, "s")
details = Card([CardHeader("Details"), List([Text("Design review", "body"), Text("Release checklist", "body")])], "card", "column", false, "s")
```

## Query And Repeated Data

Assume the host supplies a `list_tasks` read tool returning `{ rows: [...] }`.

```openui
root = Stack([header, taskList, refresh], "column", false, "m", "stretch", "start")
tasks = Query("list_tasks", {}, { rows: [{ title: "Design review", status: "open" }, { title: "Release checklist", status: "done" }] })
header = CardHeader("Tasks", @Count(tasks.rows) + " total")
taskList = List(@Each(tasks.rows, "task", Card([Text(task.title, "h4"), Tag(task.status)], "card", "column", false, "s")))
refresh = Buttons([Button("Refresh", Action([@Run(tasks)]), "secondary")])
```

## Query Driven By Text Input

Assume the host supplies a `get_weather` read tool returning weather data for
the requested city. This live pattern runs the query on each input change, so
use it only when the tool can accept that request frequency.

```openui
root = Stack([cityInput, weatherCard, refresh], "column", false, "m", "stretch", "start")
$city = "Seattle"
weather = Query("get_weather", { city: $city }, { city: "Seattle", temp: 62, condition: "Cloudy" })
cityInput = TextField("City", $city, "shortText", ".+", null, "$city")
weatherCard = Card([CardHeader(weather.city, "Current weather"), TextContent(weather.temp + " degrees", "large-heavy"), TextContent(weather.condition)], "card", "column", false, "s")
refresh = Button("Refresh", Action([@Run(weather)]), "secondary")
```

## Mutation With Ordered Feedback

Assume the host supplies a `save_preference` write tool.

```openui
root = Stack([summary, choices, submit, status], "column", false, "m", "stretch", "start")
$priority = "normal"
save = Mutation("save_preference", { priority: $priority })
summary = Card([CardHeader("Notification Priority"), TextContent("Selected: " + $priority)], "card", "column", false, "s")
choices = Buttons([Button("High", Action([@Set($priority, "high")]), "secondary"), Button("Normal", Action([@Set($priority, "normal")]), "secondary"), Button("Low", Action([@Set($priority, "low")]), "secondary")])
submit = Button("Save preference", Action([@Run(save)]), "primary")
status = save.status == "loading" ? Loading("inline") : save.status == "success" ? TextContent("Preference saved.", "small-heavy") : TextContent("Choose a priority, then save.", "small")
```

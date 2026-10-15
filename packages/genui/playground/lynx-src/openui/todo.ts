// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const OPENUI_TODO_RAW =
  `root = Column([header, summary, feedback, creator, editor, confirmation, taskList, emptyState], "start", "stretch", "m")
$adding = false
$newTitle = ""
$selectedId = ""
$editTitle = ""
$nextDone = false
$deleteId = ""
todos = Query("openui_query", { key: "todos" }, { items: [{ id: "todos-1", title: "Build a protocol-driven demo", done: false }, { id: "todos-2", title: "Review the task list", done: true }] })
addTodo = Mutation("openui_mutation", { key: "todos", value: { items: $newTitle != "" ? @Append(todos.items, { id: @Max(todos.items.id) + 1, title: $newTitle, done: false }) : todos.items } })
saveTodo = Mutation("openui_mutation", { key: "todos", value: { items: @Each(todos.items, "todo", todo.id == $selectedId ? { id: todo.id, title: $editTitle, done: todo.done } : todo) } })
toggleTodo = Mutation("openui_mutation", { key: "todos", value: { items: @Each(todos.items, "todo", todo.id == $selectedId ? { id: todo.id, title: todo.title, done: $nextDone } : todo) } })
deleteTodo = Mutation("openui_mutation", { key: "todos", value: { items: @Filter(todos.items, "id", "!=", $deleteId) } })
busy = addTodo.status == "loading" || saveTodo.status == "loading" || toggleTodo.status == "loading" || deleteTodo.status == "loading"
header = Card([Text("Todo List", "h2"), Text("Add, edit, complete and delete tasks. Changes are saved locally for this example.", "body")], "card", "column", false, "s", "stretch", "start")
summary = Row([Text(@Count(todos.items) + (@Count(todos.items) == 1 ? " task" : " tasks"), "h5"), Tag(@Count(@Filter(todos.items, "done", "==", false)) + " open"), Tag(@Count(@Filter(todos.items, "done", "==", true)) + " completed")], "start", "center", "s", true)
feedback = busy ? Text("Saving…", "caption") : addTodo.status == "error" || saveTodo.status == "error" || toggleTodo.status == "error" || deleteTodo.status == "error" ? Text("Could not save the change. Try again.", "caption") : null
newField = TextField("Task title", $newTitle, "shortText", null, null, "$newTitle")
creatorCard = Card([Text("Add task", "h5"), newField, Buttons([Button("Add task", $newTitle != "" ? Action([@Run(addTodo), @Run(todos), @Reset($adding, $newTitle)]) : Action([]), "primary"), Button("Cancel", Action([@Reset($adding, $newTitle)]), "tertiary")])], "card", "column", false, "s", "stretch", "start")
creator = busy ? null : $adding ? creatorCard : Button("Add task", Action([@Set($adding, true), @Reset($newTitle, $selectedId, $editTitle, $nextDone, $deleteId)]), "primary")
editField = TextField("Task title", $editTitle, "shortText", null, null, "$editTitle")
editorCard = Card([Text("Edit task", "h5"), editField, Buttons([Button("Save title", Action([@Run(saveTodo), @Run(todos), @Reset($selectedId, $editTitle, $nextDone)]), "primary"), Button($nextDone ? "Mark completed" : "Mark open", Action([@Run(toggleTodo), @Run(todos), @Reset($selectedId, $editTitle, $nextDone)]), "secondary"), Button("Cancel", Action([@Reset($selectedId, $editTitle, $nextDone)]), "tertiary")])], "card", "column", false, "s", "stretch", "start")
editor = !busy && $selectedId != "" ? editorCard : null
selectedTodo = @First(@Filter(todos.items, "id", "==", $deleteId))
confirmationCard = Card([Text("Delete task?", "h5"), Text($deleteId != "" ? selectedTodo.title : "", "body"), Buttons([Button("Confirm delete", Action([@Run(deleteTodo), @Reset($deleteId), @Run(todos)]), "primary", "destructive"), Button("Cancel", Action([@Reset($deleteId)]), "tertiary")])], "card", "column", false, "s", "stretch", "start")
confirmation = !busy && $deleteId != "" ? confirmationCard : null
taskList = List(@Each(todos.items, "todo", Card([Row([Text(todo.title, "h5"), Tag(todo.done ? "Completed" : "Open")], "between", "center", "s", true), busy ? null : Buttons([Button("Edit", Action([@Set($selectedId, todo.id), @Set($editTitle, todo.title), @Set($nextDone, todo.done == false), @Reset($deleteId, $adding, $newTitle)]), "secondary", "normal", "small"), Button("Delete", Action([@Set($deleteId, todo.id), @Reset($selectedId, $editTitle, $nextDone, $adding, $newTitle)]), "tertiary", "destructive", "small")])], "sunk", "column", false, "s", "stretch", "start")), null, "vertical", "stretch", "s", false)
emptyState = @Count(todos.items) == 0 ? Text("No tasks remaining.", "body") : null`;

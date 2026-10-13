// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const OPENUI_TODO_RAW =
  `root = Column([header, composer, summary, feedback, confirmation, taskList, emptyState], "start", "stretch", "m")
$newTitle = ""
$composing = true
$deleteId = ""
todos = Query("todo.list", {}, { items: [] })
createTodo = Mutation("todo.add", { title: $newTitle })
deleteTodo = Mutation("todo.remove", { id: $deleteId })
busy = createTodo.status == "loading" || deleteTodo.status == "loading"
header = Card([Text("Todo List", "h2"), Text("Add and delete tasks. Changes last for this preview session.", "body")], "card", "column", false, "s", "stretch", "start")
newTaskField = TextField("New task", $newTitle, "shortText", null, null, "$newTitle")
addAction = Action([@Run(createTodo), @Set($composing, false), @Run(todos)])
composerCard = Card([newTaskField, $newTitle != "" ? Button("Add task", addAction, "primary") : Text("Enter a title to add a task.", "caption")], "clear", "column", false, "s", "stretch", "start")
composer = busy ? Text("Saving…", "caption") : $composing ? composerCard : Button("New task", Action([@Reset($newTitle), @Set($composing, true)]), "primary")
summary = Row([Text(@Count(todos.items) + (@Count(todos.items) == 1 ? " task" : " tasks"), "h5"), Tag(@Count(@Filter(todos.items, "done", "==", false)) + " open"), Tag(@Count(@Filter(todos.items, "done", "==", true)) + " completed")], "start", "center", "s", true)
feedback = Column([createTodo.status == "error" ? Text("Could not add the task. Enter a non-empty title and try again.", "caption") : null, deleteTodo.status == "error" ? Text("Could not delete the task. Try again.", "caption") : null], "start", "stretch", "xs")
selectedTodo = @First(@Filter(todos.items, "id", "==", $deleteId))
confirmationCard = Card([Text("Delete task?", "h5"), Text($deleteId != "" ? selectedTodo.title : "", "body"), Buttons([Button("Confirm delete", Action([@Run(deleteTodo), @Reset($deleteId), @Run(todos)]), "primary", "destructive"), Button("Cancel", Action([@Reset($deleteId)]), "tertiary")])], "card", "column", false, "s", "stretch", "start")
confirmation = !busy && $deleteId != "" ? confirmationCard : null
taskList = List(@Each(todos.items, "todo", Card([Row([Text(todo.title, "h5"), Tag(todo.done ? "Completed" : "Open")], "between", "center", "s", true), busy ? null : Button("Delete", Action([@Set($deleteId, todo.id)]), "tertiary", "destructive", "small")], "sunk", "column", false, "s", "stretch", "start")), null, "vertical", "stretch", "s", false)
emptyState = @Count(todos.items) == 0 ? Text("No tasks yet. Add one to get started.", "body") : null`;

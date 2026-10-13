// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ActionEvent, OpenUIError } from '@openuidev/lang-core';
import { createParser } from '@openuidev/lang-core';
import { expect, rstest, test } from '@rstest/core';

import { fireEvent, render, waitFor } from '@lynx-js/react/testing-library';

import { createOpenUiChatLibrary } from '../src/chat/index.js';
import { OpenUiRenderer } from '../src/core/renderer.jsx';

const library = createOpenUiChatLibrary();
const response = `root = Card([steps, list, table, sections, products, feature])
steps = Steps([StepsItem("Arrive", "**Check in** at the hotel")])
list = ListBlock([ListItem("Museum", "Open the guide", {src:"/museum.jpg",alt:"Museum exterior"}, "Guide", @OpenUrl("https://example.com/museum"))], "image", "small")
table = Table([Col("Item", ["Ticket", "Lunch"]), Col("Cost", [12], "number"), Col("Action", [Button("Book", @ToAssistant("Book"))], "action")])
sections = SectionBlock([SectionItem("one", "Details", [TextContent("First section")]), SectionItem("two", "More", [TextContent("Second section")])])
products = CompositeCardBlock([productA, productB], "grid", true, @ToAssistant("Compare", "short"), 12)
productA = CompositeCardItem("a", ImageText("/a.jpg", "Camera A", "Camera A", "Compact", true, "vertical", 120), [Text("text", "Travel camera")], {price:BoldText("number", "$500"),button:Button("Buy A", @OpenUrl("https://example.com/a"))})
productB = CompositeCardItem("b", ImageText("/b.jpg", "Camera B", "Camera B"), [Text("text", "Interchangeable lens")])
feature = ProductFeature("/feature.jpg", "Sample camera", "Featured camera", "A document extension", ["Lightweight body"], "$600", "https://example.com/feature")`;

test('display cases parse with their official positional arguments', () => {
  const result = createParser(library.toJSONSchema(), library.root).parse(
    response,
  );
  expect(result.meta.errors).toEqual([]);
  expect(result.meta.unresolved).toEqual([]);
  expect(result.meta.incomplete).toBe(false);
});

test('tables, lists, steps and product cards render and dispatch item context', async () => {
  const onAction = rstest.fn<(event: ActionEvent) => void>();
  const onError = rstest.fn<(errors: OpenUIError[]) => void>();
  const view = render(
    <OpenUiRenderer
      library={library}
      response={response}
      onAction={onAction}
      onError={onError}
    />,
  );
  for (
    const text of [
      'Arrive',
      'Museum',
      'Ticket',
      'Lunch',
      'Book',
      'Featured camera',
    ]
  ) expect(view.getByText(text)).toBeTruthy();
  fireEvent.tap(view.getByText('Museum'), { bubbles: true });
  await waitFor(() =>
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        params: { url: 'https://example.com/museum' },
      }),
    )
  );
  onAction.mockClear();
  fireEvent.tap(view.getByText('Travel camera'), { bubbles: true });
  await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  expect(onAction.mock.calls[0]?.[0].params).toMatchObject({
    itemId: 'a',
    context: 'short',
  });
  onAction.mockClear();
  fireEvent.tap(view.getByText('Buy A'), { bubbles: true });
  await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
  expect(onAction).toHaveBeenCalledWith(
    expect.objectContaining({ params: { url: 'https://example.com/a' } }),
  );
  expect(onError.mock.calls.flatMap(([errors]) => errors)).toEqual([]);
});

test('folding keeps section content mounted', () => {
  const view = render(
    <OpenUiRenderer
      library={library}
      response='root = Card([SectionBlock([SectionItem("one", "Toggle", [TextContent("Saved content")])])])'
    />,
  );
  const content = view.getByText('Saved content');
  fireEvent.tap(view.getByText('Toggle'), { bubbles: true });
  expect(view.getByText('Saved content')).toBe(content);
  fireEvent.tap(view.getByText('Toggle'), { bubbles: true });
  expect(view.getByText('Saved content')).toBe(content);
});

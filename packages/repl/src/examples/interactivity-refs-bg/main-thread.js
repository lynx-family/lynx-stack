// Demonstrates: Background thread identifying elements via event data
//
// The background thread cannot directly access elements — they live on
// the main thread. Instead, it identifies elements through the event:
//   event.currentTarget.id       — the string ID set via __SetID
//   event.currentTarget.dataset  — data attributes set via __SetDataset
//
// The background thread uses this info to make decisions, then sends
// instructions back to the main thread, which finds and updates elements
// using __QuerySelector("#id").
//
// NOTE: __CreateView(1) / __CreateText(1) — the argument is the
// parentComponentUniqueId. The page element always gets uniqueId 1.
// String event handlers require a valid parentComponentUniqueId to
// route events to the background thread.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(1);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(1);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Element Refs: Background Thread'));
  __SetInlineStyles(
    title,
    'font-size:18px; font-weight:700; margin-bottom:8px;',
  );

  const subtitle = __CreateText(1);
  __AppendElement(container, subtitle);
  __AppendElement(
    subtitle,
    __CreateRawText(
      'Background identifies elements via event.target.id & dataset',
    ),
  );
  __SetInlineStyles(
    subtitle,
    'font-size:13px; color:#888; margin-bottom:24px;',
  );

  // Status display
  const status = __CreateText(1);
  const statusRaw = __CreateRawText('Tap a card to select it');
  __AppendElement(container, status);
  __AppendElement(status, statusRaw);
  __SetInlineStyles(status, 'font-size:14px; color:#666; margin-bottom:16px;');

  // Create selectable cards with IDs and dataset attributes
  const items = [
    { id: 'card-apple', label: 'Apple', bg: '#fee2e2' },
    { id: 'card-banana', label: 'Banana', bg: '#fef9c3' },
    { id: 'card-grape', label: 'Grape', bg: '#ede9fe' },
  ];

  const baseStyle =
    'width:220px; padding:16px; border-radius:12px; margin-bottom:8px; '
    + 'align-items:center; border-width:2px; border-style:solid;';

  for (const item of items) {
    const card = __CreateView(1);
    __AppendElement(container, card);

    // __SetID — gives the element a string ID accessible from both threads
    __SetID(card, item.id);

    // __SetDataset — attaches data the background thread can read
    __SetDataset(card, { label: item.label });

    __SetInlineStyles(
      card,
      baseStyle + ' border-color:transparent; background-color:' + item.bg
        + ';',
    );

    const label = __CreateText(1);
    __AppendElement(card, label);
    __AppendElement(label, __CreateRawText(item.label));
    __SetInlineStyles(label, 'font-size:16px; font-weight:600;');

    // String handler → background thread receives the event
    // with event.target.id and event.target.dataset populated
    __AddEvent(card, 'bindEvent', 'tap', 'onCardTap');
  }

  __FlushElementTree();

  // Listen for selection updates from the background thread
  lynx.getJSContext().addEventListener('selectionUpdate', (event) => {
    const { selectedId, label } = event.data;
    __SetAttribute(
      statusRaw,
      'text',
      selectedId ? 'Selected: ' + label : 'Tap a card to select it',
    );

    // Main thread uses __QuerySelector to find elements by their ID
    for (const item of items) {
      const card = __QuerySelector(page, '#' + item.id);
      if (card) {
        const isSelected = item.id === selectedId;
        __SetInlineStyles(
          card,
          baseStyle
            + ' border-color:' + (isSelected ? '#3b82f6' : 'transparent')
            + '; background-color:' + item.bg + ';',
        );
      }
    }
    __FlushElementTree();
  });
};

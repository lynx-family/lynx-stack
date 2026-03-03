// Demonstrates: Event handling on the background thread
//
// In Lynx's dual-thread model, string event handlers dispatch events
// to the background thread for processing. This keeps the UI responsive
// while business logic runs off the main thread.
//
// __AddEvent(element, eventType, eventName, "handlerName")
//   When the 4th argument is a string, the event is sent to the background
//   thread via the publishEvent RPC. The background thread looks up the
//   named function and invokes it with the event object.
//
// Flow: User tap → main thread (string handler)
//       → publishEvent RPC → background thread (named function)
//       → background updates state → dispatchEvent → main thread re-renders
//
// NOTE: __CreateView(1) / __CreateText(1) — the second argument is the
// parentComponentUniqueId. The page element always gets uniqueId 1, so
// passing 1 means "this element belongs to the page component." String
// event handlers require a valid parentComponentUniqueId to route the
// event to the correct background thread handler.

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(1);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(1);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Event Handling: Background Thread'));
  __SetInlineStyles(
    title,
    'font-size:18px; font-weight:700; margin-bottom:8px;',
  );

  const subtitle = __CreateText(1);
  __AppendElement(container, subtitle);
  __AppendElement(
    subtitle,
    __CreateRawText('Tap dispatches to background thread, which manages state'),
  );
  __SetInlineStyles(
    subtitle,
    'font-size:13px; color:#888; margin-bottom:24px;',
  );

  // Counter display
  const counter = __CreateText(1);
  const counterRaw = __CreateRawText('0');
  __AppendElement(container, counter);
  __AppendElement(counter, counterRaw);
  __SetInlineStyles(
    counter,
    'font-size:48px; font-weight:700; color:#3b82f6; margin-bottom:24px;',
  );

  // Buttons
  const row = __CreateView(1);
  __AppendElement(container, row);
  __SetInlineStyles(row, 'flex-direction:row; gap:12px;');

  const decBtn = __CreateView(1);
  __AppendElement(row, decBtn);
  __SetInlineStyles(
    decBtn,
    'padding:12px 24px; background-color:#ef4444; border-radius:8px;',
  );
  const decLabel = __CreateText(1);
  __AppendElement(decBtn, decLabel);
  __AppendElement(decLabel, __CreateRawText('- 1'));
  __SetInlineStyles(decLabel, 'color:#fff; font-size:16px; font-weight:600;');

  // String handler name → dispatched to the background thread
  __AddEvent(decBtn, 'bindEvent', 'tap', 'onDecrement');

  const incBtn = __CreateView(1);
  __AppendElement(row, incBtn);
  __SetInlineStyles(
    incBtn,
    'padding:12px 24px; background-color:#22c55e; border-radius:8px;',
  );
  const incLabel = __CreateText(1);
  __AppendElement(incBtn, incLabel);
  __AppendElement(incLabel, __CreateRawText('+ 1'));
  __SetInlineStyles(incLabel, 'color:#fff; font-size:16px; font-weight:600;');

  // String handler name → dispatched to the background thread
  __AddEvent(incBtn, 'bindEvent', 'tap', 'onIncrement');

  __FlushElementTree();

  // Main thread listens for state updates from the background thread
  lynx.getJSContext().addEventListener('counterUpdate', (event) => {
    __SetAttribute(counterRaw, 'text', String(event.data.count));
    __FlushElementTree();
  });
};

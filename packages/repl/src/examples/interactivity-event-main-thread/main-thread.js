// Demonstrates: Event handling directly on the main thread
//
// Unlike string handlers (which dispatch to the background thread),
// worklet handlers run synchronously on the main thread. This means
// zero cross-thread round trip, direct element access, and instant UI.
//
// __AddEvent(element, eventType, eventName, { type: 'worklet', value: id })
//   When the 4th argument is an object with type 'worklet', the event
//   handler runs on the main thread via globalThis.runWorklet(id, [event]).
//
// In @lynx-js/react, this corresponds to:
//   main-thread:bindtap={(e) => { 'main thread'; ... }}

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const title = __CreateText(0);
  __AppendElement(container, title);
  __AppendElement(title, __CreateRawText('Event Handling: Main Thread'));
  __SetInlineStyles(
    title,
    'font-size:18px; font-weight:700; margin-bottom:8px;',
  );

  const subtitle = __CreateText(0);
  __AppendElement(container, subtitle);
  __AppendElement(
    subtitle,
    __CreateRawText('Handlers run on main thread — instant, no round trip'),
  );
  __SetInlineStyles(
    subtitle,
    'font-size:13px; color:#888; margin-bottom:24px;',
  );

  // Color cycling demo
  const colors = [
    '#3b82f6',
    '#ef4444',
    '#22c55e',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
  ];
  let colorIndex = 0;

  const colorBox = __CreateView(0);
  __AppendElement(container, colorBox);
  __SetInlineStyles(
    colorBox,
    'width:200px; height:200px; background-color:' + colors[0]
      + '; border-radius:16px; align-items:center; justify-content:center; margin-bottom:16px;',
  );

  const colorLabel = __CreateText(0);
  const colorLabelRaw = __CreateRawText(colors[0]);
  __AppendElement(colorBox, colorLabel);
  __AppendElement(colorLabel, colorLabelRaw);
  __SetInlineStyles(colorLabel, 'color:#fff; font-size:14px; font-weight:600;');

  let tapCount = 0;
  const tapInfo = __CreateText(0);
  const tapInfoRaw = __CreateRawText('Tap the box');
  __AppendElement(container, tapInfo);
  __AppendElement(tapInfo, tapInfoRaw);
  __SetInlineStyles(tapInfo, 'font-size:14px; color:#666; margin-bottom:24px;');

  // Set up the worklet handler router on globalThis.
  // The runtime calls: globalThis.runWorklet(handler.value, [eventObject])
  const handlers = {};
  globalThis.runWorklet = function(handlerId, args) {
    if (handlers[handlerId]) handlers[handlerId](...args);
  };

  // Define the handler — runs synchronously on the main thread
  handlers['onColorTap'] = function(_event) {
    colorIndex = (colorIndex + 1) % colors.length;
    tapCount++;

    // Direct element manipulation — no cross-thread communication needed
    __SetInlineStyles(
      colorBox,
      'width:200px; height:200px; background-color:' + colors[colorIndex]
        + '; border-radius:16px; align-items:center; justify-content:center; margin-bottom:16px;',
    );
    __SetAttribute(colorLabelRaw, 'text', colors[colorIndex]);
    __SetAttribute(tapInfoRaw, 'text', 'Tapped ' + tapCount + ' times');
    __FlushElementTree();
  };

  // Worklet handler object → runs directly on the main thread
  __AddEvent(colorBox, 'bindEvent', 'tap', {
    type: 'worklet',
    value: 'onColorTap',
  });

  __FlushElementTree();
};

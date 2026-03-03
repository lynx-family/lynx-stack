// Demonstrates: __AddEvent with "bindEvent" and "catchEvent"
//
// __AddEvent(element, eventType, eventName, handler)
//   eventType: "bindEvent" (bubbles) or "catchEvent" (catches, stops propagation)
//   eventName: Lynx event name, e.g. "tap" (maps to "click" in web)
//   handler: a string name (dispatched to background via publishEvent)
//
// In the web platform, "tap" maps to the browser "click" event.
// String handlers are sent to the background thread — the background
// listens via lynx.getJSContext().addEventListener("event").

globalThis.renderPage = function renderPage() {
  const page = __CreatePage('page', 0);
  const container = __CreateView(0);
  __AppendElement(page, container);
  __SetInlineStyles(container, 'padding:40px; align-items:center;');

  const log = __CreateText(0);
  const logText = __CreateRawText('Tap a button...');
  __AppendElement(container, log);
  __AppendElement(log, logText);
  __SetInlineStyles(log, 'font-size:14px; color:#666; margin-bottom:20px;');

  // Outer view with bindEvent — events bubble through it
  const outer = __CreateView(0);
  __AppendElement(container, outer);
  __SetInlineStyles(
    outer,
    'padding:20px; background-color:#eff6ff; border-radius:12px; align-items:center;',
  );

  const outerLabel = __CreateText(0);
  __AppendElement(outer, outerLabel);
  __AppendElement(outerLabel, __CreateRawText('Outer (bindEvent: tap)'));
  __SetInlineStyles(
    outerLabel,
    'font-size:12px; color:#3b82f6; margin-bottom:12px;',
  );

  // bindEvent — the event bubbles up to parent
  __AddEvent(outer, 'bindEvent', 'tap', 'onOuterTap');

  // Inner button with catchEvent — stops propagation
  const inner = __CreateView(0);
  __AppendElement(outer, inner);
  __SetInlineStyles(
    inner,
    'padding:12px 24px; background-color:#3b82f6; border-radius:8px;',
  );
  const innerLabel = __CreateText(0);
  __AppendElement(inner, innerLabel);
  __AppendElement(innerLabel, __CreateRawText('Inner (catchEvent: tap)'));
  __SetInlineStyles(innerLabel, 'color:#fff; font-size:14px; font-weight:600;');

  // catchEvent — handles the event and stops propagation
  __AddEvent(inner, 'catchEvent', 'tap', 'onInnerTap');

  // A sibling button with bindEvent — tap bubbles to outer
  const sibling = __CreateView(0);
  __AppendElement(outer, sibling);
  __SetInlineStyles(
    sibling,
    'padding:12px 24px; background-color:#dbeafe; border-radius:8px; margin-top:8px;',
  );
  const siblingLabel = __CreateText(0);
  __AppendElement(sibling, siblingLabel);
  __AppendElement(siblingLabel, __CreateRawText('Sibling (bindEvent: tap)'));
  __SetInlineStyles(
    siblingLabel,
    'color:#1e40af; font-size:14px; font-weight:600;',
  );

  __AddEvent(sibling, 'bindEvent', 'tap', 'onSiblingTap');

  __FlushElementTree();

  // Listen for events dispatched from the event system
  lynx.getJSContext().addEventListener('event', (e) => {
    __SetAttribute(logText, 'text', 'Event: ' + e.data.name);
    __FlushElementTree();
  });
};

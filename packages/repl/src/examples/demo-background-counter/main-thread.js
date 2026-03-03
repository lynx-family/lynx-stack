// Demo: Background-Driven Counter
// Combines: cross-thread events, element creation, style updates
//
// The background thread drives a counter via setInterval,
// dispatching "tick" events to the main thread.

const page = __CreatePage('page', 0);
const view = __CreateView(0);
const label = __CreateText(0);
const labelText = __CreateRawText('Counter:');
const counter = __CreateText(0);
const counterText = __CreateRawText('0');

__AppendElement(page, view);
__AppendElement(view, label);
__AppendElement(label, labelText);
__AppendElement(view, counter);
__AppendElement(counter, counterText);

__SetInlineStyles(
  view,
  'display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; background-color:#f0fdf4;',
);
__SetInlineStyles(label, 'font-size:16px; color:#666;');
__SetInlineStyles(
  counter,
  'font-size:48px; font-weight:700; color:#16a34a; margin-top:8px;',
);

__FlushElementTree();

// Listen for "tick" events dispatched from the background thread
lynx.getJSContext().addEventListener('tick', (event) => {
  __SetAttribute(counterText, 'text', String(event.data.count));
  __FlushElementTree();
});

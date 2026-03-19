// Demonstrates: lynx.getJSContext().addEventListener,
//               lynx.getCoreContext().dispatchEvent
//
// Lynx runs on two threads:
//   Main thread — UI rendering (this file)
//   Background thread — business logic (background.js, runs in a Web Worker)
//
// They communicate via events on LynxCrossThreadContext.

const page = __CreatePage('page', 0);
const container = __CreateView(0);
__AppendElement(page, container);
__SetInlineStyles(container, 'padding:40px; align-items:center;');

const title = __CreateText(0);
__AppendElement(container, title);
__AppendElement(title, __CreateRawText('Cross-Thread Communication'));
__SetInlineStyles(title, 'font-size:18px; font-weight:700;');

const status = __CreateText(0);
const statusText = __CreateRawText('Waiting for background thread...');
__AppendElement(container, status);
__AppendElement(status, statusText);
__SetInlineStyles(status, 'font-size:14px; color:#666; margin-top:12px;');

__FlushElementTree();

// lynx.getJSContext().addEventListener — listen for events from background
lynx.getJSContext().addEventListener('greeting', (event) => {
  __SetAttribute(statusText, 'text', 'Received: ' + event.data.message);
  __FlushElementTree();
});

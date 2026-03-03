// Console output from main-thread — see the console panel below
const page = __CreatePage('page', 0);
const view = __CreateElement('view', 'view', 0);
__SetAttribute(view, 'style', 'padding: 20; gap: 12;');

const title = __CreateElement('text', 'text', 0);
__SetAttribute(
  title,
  'style',
  'font-size: 18; font-weight: bold; color: #333;',
);
__SetContent(title, 'Console Demo');

const hint = __CreateElement('text', 'text', 0);
__SetAttribute(hint, 'style', 'font-size: 14; color: #666;');
__SetContent(hint, 'Check the console panel below the preview!');

__AppendElement(view, title);
__AppendElement(view, hint);
__AppendElement(page, view);
__FlushElementTree();

console.log('Hello from main-thread!');
console.info('Info message:', JSON.stringify({ thread: 'main' }));
console.warn('Warning example from main-thread');
console.error('Error example from main-thread');
console.debug('Debug details:', 42);

globalThis.renderPage = () => {};

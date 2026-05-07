const page = __CreatePage('0', 0);
const pageId = __GetElementUniqueID(page);
__SetClasses(page, 'page');

let rawText: FiberElement | undefined = undefined;
function renderPage(data: Record<string, unknown>): void {
  console.info('renderPage', data);
  const text = __CreateText(pageId);
  __SetClasses(text, 'content');
  __AddEvent(text, 'bindEvent', 'tap', 'handleClick');
  rawText = __CreateRawText('Hello World!');
  __AppendElement(text, rawText);
  __AppendElement(page, text);
}

function updatePage(data: Record<string, unknown>): void {
  if (!rawText) return;
  console.info('updatePage', data);
  __SetAttribute(rawText, 'text', data['content']);
  __FlushElementTree();
}

function getPageData() {
  return {};
}

function processData(data: Record<string, unknown>) {
  return data;
}

const calledByNative = {
  renderPage,
  updatePage,
  getPageData,
  processData,
};

Object.assign(globalThis, calledByNative);

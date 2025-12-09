import { JSDOM } from 'jsdom';
const { window } = new JSDOM(undefined, { url: 'http://localhost/' });
const document = window.document;
Object.assign(globalThis, {
  document,
  window,
  Window: window.Window,
  CustomEvent: window.CustomEvent,
  HTMLElement: window.HTMLElement,
  customElements: window.customElements,
});

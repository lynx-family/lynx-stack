import { describe, it, expect, beforeAll } from 'vitest';
import { MainThreadGlobalThis } from '../dist/debug.js';
import { GlobalWindow, Window } from 'happy-dom';
const window = new Window();
const document = window.document;
Object.assign(globalThis, { document, window, Window });
const lynxViewDom = document.createElement('div');
const rootDom = lynxViewDom.attachShadow({ mode: 'open' });
// @ts-expect-error
const mtsGlobalThis = new MainThreadGlobalThis(
  // @ts-expect-error
  rootDom,
  {
    globalWindow: window,
  } as any,
  {} as any,
  {} as any,
  true,
  true,
  true,
  true,
);
describe('Element APIs', () => {
});

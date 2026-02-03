/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import MarkdownIt from 'markdown-it';
import {
  boostedQueueMicrotask,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';
import type { XMarkdown } from './XMarkdown.js';

const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
});

const unitlessCssProperties = new Set([
  'font-weight',
  'line-height',
  'opacity',
  'z-index',
  'flex',
  'flex-grow',
  'flex-shrink',
  'order',
]);

const selectorMap: Record<string, string | string[]> = {
  normalText: '.markdown-body',
  link: '.markdown-body a',
  inlineCode: '.markdown-body code:not(pre code)',
  codeBlock: ['.markdown-body pre', '.markdown-body pre code'],
  h1: '.markdown-body h1',
  h2: '.markdown-body h2',
  h3: '.markdown-body h3',
  h4: '.markdown-body h4',
  h5: '.markdown-body h5',
  h6: '.markdown-body h6',
  quote: '.markdown-body blockquote',
  orderedList: '.markdown-body ol',
  unorderedList: '.markdown-body ul',
  listItem: '.markdown-body li',
  image: '.markdown-body img',
  span: '.markdown-body span',
  p: '.markdown-body p',
};

const normalizeColor = (value: string) => {
  const hex = value.trim();
  if (/^[0-9a-fA-F]{6,8}$/.test(hex)) {
    return `#${hex}`;
  }
  return value;
};

const camelToKebab = (value: string) =>
  value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const toCssValue = (property: string, value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    return unitlessCssProperties.has(property) ? `${value}` : `${value}px`;
  }
  if (typeof value === 'string') {
    if (property.includes('color')) {
      return normalizeColor(value);
    }
    return value;
  }
  return null;
};

const parseMarkdownStyle = (value: string | null) => {
  if (!value) return {} as Record<string, Record<string, unknown>>;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, Record<string, unknown>>;
    }
  } catch {
    return {} as Record<string, Record<string, unknown>>;
  }
  return {} as Record<string, Record<string, unknown>>;
};

const buildMarkdownStyleCss = (
  style: Record<string, Record<string, unknown>>,
) => {
  const rules: string[] = [];
  for (const [key, properties] of Object.entries(style)) {
    if (!properties || typeof properties !== 'object') continue;
    let selectors: string[] = [];
    if (key.startsWith('.') || key.startsWith('#')) {
      selectors = [`.markdown-body ${key}`];
    } else if (selectorMap[key]) {
      selectors = Array.isArray(selectorMap[key])
        ? (selectorMap[key] as string[])
        : [selectorMap[key] as string];
    } else {
      continue;
    }
    const declarations = Object.entries(properties)
      .map(([property, value]) => {
        const cssProperty = camelToKebab(property);
        const cssValue = toCssValue(cssProperty, value);
        return cssValue ? `${cssProperty}: ${cssValue};` : null;
      })
      .filter(Boolean)
      .join('');
    if (!declarations) continue;
    for (const selector of selectors) {
      rules.push(`${selector} {${declarations}}`);
    }
  }
  return rules.join('\n');
};

export class XMarkdownAttributes {
  static observedAttributes = ['content', 'markdown-style', 'content-id'];

  readonly #dom: XMarkdown;
  readonly #root = genDomGetter(() => this.#dom.shadowRoot!, '#markdown-root');
  readonly #style = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#markdown-style',
  );

  #pendingRender = false;
  #content = '';
  #contentId?: string;
  #eventsAttached = false;

  constructor(dom: XMarkdown) {
    this.#dom = dom;
  }

  connectedCallback() {
    this.#ensureEvents();
  }

  dispose() {
    if (!this.#eventsAttached) return;
    const root = this.#root();
    root.removeEventListener('click', this.#handleClick);
    this.#eventsAttached = false;
  }

  #ensureEvents() {
    if (this.#eventsAttached) return;
    const root = this.#root();
    root.addEventListener('click', this.#handleClick);
    this.#eventsAttached = true;
  }

  #handleClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (!target) return;
    const root = this.#root();
    const anchor = target.closest('a');
    if (anchor && root.contains(anchor)) {
      event.preventDefault();
      this.#dom.dispatchEvent(
        new CustomEvent('bindlink', {
          detail: {
            url: anchor.getAttribute('href') ?? '',
            content: anchor.textContent ?? '',
            contentId: this.#contentId,
          },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }
    const image = target.closest('img');
    if (image && root.contains(image)) {
      this.#dom.dispatchEvent(
        new CustomEvent('bindimageTap', {
          detail: {
            url: image.getAttribute('src') ?? '',
            contentId: this.#contentId,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  #scheduleRender() {
    if (this.#pendingRender) return;
    this.#pendingRender = true;
    boostedQueueMicrotask(() => {
      this.#pendingRender = false;
      this.#render();
    });
  }

  #render() {
    const root = this.#root();
    if (!this.#content) {
      root.innerHTML = '';
      return;
    }
    root.innerHTML = markdownParser.render(this.#content);
  }

  #applyMarkdownStyle(value: string | null) {
    const styleTag = this.#style();
    const parsed = parseMarkdownStyle(value);
    styleTag.textContent = buildMarkdownStyleCss(parsed);
  }

  @registerAttributeHandler('content', true)
  _handleContent(newVal: string | null) {
    this.#content = newVal ?? '';
    this.#scheduleRender();
  }

  @registerAttributeHandler('markdown-style', true)
  _handleMarkdownStyle(newVal: string | null) {
    this.#applyMarkdownStyle(newVal);
  }

  @registerAttributeHandler('content-id', true)
  _handleContentId(newVal: string | null) {
    this.#contentId = newVal ?? undefined;
  }
}

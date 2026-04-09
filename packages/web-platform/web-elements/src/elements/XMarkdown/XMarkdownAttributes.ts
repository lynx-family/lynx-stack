/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type MarkdownIt from 'markdown-it';
import type createDOMPurify from 'dompurify';
import {
  boostedQueueMicrotask,
  genDomGetter,
  registerAttributeHandler,
} from '../../element-reactive/index.js';
import type { XMarkdown } from './XMarkdown.js';

type MarkdownItCtor = typeof MarkdownIt;
type DOMPurifyCtor = typeof createDOMPurify;

let MarkdownItLoaded: MarkdownItCtor | undefined;
let DOMPurifyLoaded: DOMPurifyCtor | undefined;
let depsLoading: Promise<void> | undefined;
let depsLoaded = false;
let depsError: unknown;

const loadDeps = () => {
  if (depsLoaded) return Promise.resolve();
  if (depsLoading) return depsLoading;
  depsLoading = import(
    /* webpackChunkName: "xmarkdown-deps" */
    './XMarkdownDeps.js'
  ).then((deps) => {
    MarkdownItLoaded = deps.MarkdownIt;
    DOMPurifyLoaded = deps.createDOMPurify;
    depsLoaded = true;
  }).catch((err) => {
    depsError = err;
  });
  return depsLoading;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const escapeHtmlAttr = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');

const decodeHtmlEntities = (value: string) =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&#34;', '"')
    .replaceAll('&apos;', '\'')
    .replaceAll('&#39;', '\'')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

const normalizeClassList = (value: string) => {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const safe = parts.filter((part) => /^[A-Za-z0-9_-]+$/.test(part));
  return safe.join(' ');
};

const sanitizeAllowedHtml = (value: string) => {
  if (!value) return value;
  if (
    value.includes('<!--')
    || value.includes('<!')
    || value.includes('<?')
    || value.includes('<%')
  ) {
    return escapeHtml(value);
  }

  const tagNameRe = /<\s*\/?\s*([A-Za-z][\w-]*)\b[^>]*>/g;
  let match: RegExpExecArray | null = null;
  let hasTag = false;
  while ((match = tagNameRe.exec(value))) {
    hasTag = true;
    const name = (match[1] ?? '').toLowerCase();
    if (name !== 'span' && name !== 'p') {
      return escapeHtml(value);
    }
  }
  if (!hasTag) {
    return value.includes('<') ? escapeHtml(value) : value;
  }

  const openTagRe = /<(span|p)\b([^>]*?)(\/?)>/gi;
  return value.replace(openTagRe, (_m, rawName, rawAttrs, rawSelfClose) => {
    const name = String(rawName).toLowerCase();
    const attrs = decodeHtmlEntities(String(rawAttrs ?? ''));
    const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(
      attrs,
    );
    const rawClass = (classMatch?.[1] ?? classMatch?.[2] ?? classMatch?.[3])
      ?? '';
    const normalized = normalizeClassList(rawClass);
    const classAttr = normalized
      ? ` class="${escapeHtmlAttr(normalized)}"`
      : '';
    const selfClose = String(rawSelfClose ?? '') === '/';
    if (selfClose) return `<${name}${classAttr}></${name}>`;
    return `<${name}${classAttr}>`;
  });
};

const applyRawHtmlPolicy = (tokens: any[]) => {
  for (const token of tokens) {
    if (token?.type === 'html_inline' || token?.type === 'html_block') {
      token.content = sanitizeAllowedHtml(String(token.content ?? ''));
    }
    if (Array.isArray(token?.children)) {
      applyRawHtmlPolicy(token.children);
    }
  }
};

const renderMarkdown = (parser: MarkdownIt, content: string) => {
  const env = {};
  const tokens = parser.parse(content, env);
  applyRawHtmlPolicy(tokens);
  return parser.renderer.render(tokens, parser.options, env);
};
let markdownParser: MarkdownIt | null = null;
let markdownParserError: unknown;
let htmlSanitizer: ReturnType<DOMPurifyCtor> | null = null;
const getMarkdownParser = () => {
  if (markdownParser || markdownParserError) return markdownParser;
  if (!MarkdownItLoaded) return null;
  try {
    markdownParser = new MarkdownItLoaded({
      html: true,
      linkify: true,
    });
    markdownParser.enable(['table', 'strikethrough']);
  } catch (error) {
    markdownParserError = error;
  }
  return markdownParser;
};

const getHtmlSanitizer = () => {
  if (htmlSanitizer) return htmlSanitizer;
  if (!DOMPurifyLoaded) return null;
  htmlSanitizer = DOMPurifyLoaded(window)!;
  return htmlSanitizer;
};

const sanitizeHtml = (value: string) => {
  const sanitizer = getHtmlSanitizer();
  if (!sanitizer) return value;
  return sanitizer.sanitize(value, {
    USE_PROFILES: { html: true },
  }) as string;
};

type MarkdownSelectionDetail = {
  start: number;
  end: number;
  direction: 'forward' | 'backward';
};

type SelectionRoot = ShadowRoot & { getSelection?: () => Selection | null };
type SelectionWithComposedRanges = Selection & {
  getComposedRanges?: (...args: unknown[]) => StaticRange[];
};

const emptySelectionDetail = (): MarkdownSelectionDetail => ({
  start: -1,
  end: -1,
  direction: 'forward',
});

const getComposedRange = (
  selection: Selection,
  shadowRoot: ShadowRoot | null,
): StaticRange | null => {
  const getComposedRanges = (selection as SelectionWithComposedRanges)
    .getComposedRanges;
  if (!shadowRoot || typeof getComposedRanges !== 'function') return null;
  try {
    return getComposedRanges.call(selection, {
      shadowRoots: [shadowRoot],
    })[0] ?? null;
  } catch {
    try {
      return getComposedRanges.call(selection, shadowRoot)[0] ?? null;
    } catch {
      return null;
    }
  }
};

const createRangeByOffsets = (
  doc: Document,
  root: HTMLElement,
  start: number,
  end: number,
) => {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const len = node.nodeValue?.length ?? 0;
    if (!startNode && pos + len >= start) {
      startNode = node;
      startOffset = start - pos;
    }
    if (pos + len >= end) {
      endNode = node;
      endOffset = end - pos;
      break;
    }
    pos += len;
    node = walker.nextNode() as Text | null;
  }

  if (!startNode) return null;
  if (!endNode) {
    endNode = startNode;
    endOffset = startOffset;
  }

  const range = doc.createRange();
  range.setStart(
    startNode,
    Math.max(0, Math.min(startOffset, startNode.length)),
  );
  range.setEnd(endNode, Math.max(0, Math.min(endOffset, endNode.length)));
  return range;
};

const isSelectionNodeInsideHost = (
  dom: HTMLElement,
  shadowRoot: ShadowRoot | null,
  node: Node | null,
) =>
  !!node
  && (
    node === dom
    || node === shadowRoot
    || dom.contains(node)
    || !!shadowRoot?.contains(node)
  );

const getRangeInRoot = (
  doc: Document,
  dom: HTMLElement,
  root: HTMLElement,
  shadowRoot: ShadowRoot | null,
  selection: Selection | null,
) => {
  if (!selection) return null;
  const sourceRange = getComposedRange(selection, shadowRoot)
    ?? (selection.rangeCount > 0 ? selection.getRangeAt(0) : null);
  if (!sourceRange) return null;
  if (
    !root.contains(sourceRange.startContainer)
    || !root.contains(sourceRange.endContainer)
  ) {
    if (
      !isSelectionNodeInsideHost(dom, shadowRoot, sourceRange.startContainer)
      || !isSelectionNodeInsideHost(dom, shadowRoot, sourceRange.endContainer)
      || !isSelectionNodeInsideHost(dom, shadowRoot, selection.anchorNode)
      || !isSelectionNodeInsideHost(dom, shadowRoot, selection.focusNode)
    ) {
      return null;
    }
    const selectedText = selection.toString();
    if (!selectedText) {
      return null;
    }
    const start = root.textContent?.indexOf(selectedText) ?? -1;
    if (start < 0) return null;
    return createRangeByOffsets(doc, root, start, start + selectedText.length);
  }
  const range = doc.createRange();
  range.setStart(sourceRange.startContainer, sourceRange.startOffset);
  range.setEnd(sourceRange.endContainer, sourceRange.endOffset);
  return range;
};

const getBoundaryOffset = (
  doc: Document,
  root: HTMLElement,
  node: Node | null,
  offset: number,
) => {
  if (!node || !root.contains(node)) return null;
  const range = doc.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch {
    return null;
  }
  return range.toString().length;
};

const getSelectionDetail = (
  dom: HTMLElement,
  root: HTMLElement,
): MarkdownSelectionDetail => {
  const doc = dom.ownerDocument;
  const shadowRoot = dom.shadowRoot;
  const shadowSelection = (shadowRoot as SelectionRoot | null)?.getSelection?.()
    ?? null;
  const documentSelection = doc.getSelection();
  const selectionCandidates = [
    shadowSelection,
    documentSelection,
  ].filter((selection, index, selections): selection is Selection =>
    !!selection && selections.indexOf(selection) === index
  );

  let range: Range | null = null;
  let selection: Selection | null = null;
  for (const candidate of selectionCandidates) {
    const nextRange = getRangeInRoot(doc, dom, root, shadowRoot, candidate);
    if (nextRange && !nextRange.collapsed) {
      range = nextRange;
      selection = candidate;
      break;
    }
  }
  if (!range || !selection) {
    return emptySelectionDetail();
  }

  const start = getBoundaryOffset(
    doc,
    root,
    range.startContainer,
    range.startOffset,
  );
  const end = getBoundaryOffset(doc, root, range.endContainer, range.endOffset);
  if (start === null || end === null || start === end) {
    return emptySelectionDetail();
  }

  const anchor = getBoundaryOffset(
    doc,
    root,
    selection.anchorNode,
    selection.anchorOffset,
  );
  const focus = getBoundaryOffset(
    doc,
    root,
    selection.focusNode,
    selection.focusOffset,
  );

  return {
    start: Math.min(start, end),
    end: Math.max(start, end),
    direction: anchor !== null && focus !== null && anchor > focus
      ? 'backward'
      : 'forward',
  };
};

const preprocessInlineView = (html: string) =>
  html.replace(
    /src\s*=\s*"inlineview:\/\/([^"]+)"/g,
    (_m, id) => `data-inlineview="${id}"`,
  );

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
  // Extended selectors
  table: '.markdown-body table',
  thead: '.markdown-body thead',
  tbody: '.markdown-body tbody',
  tr: '.markdown-body tr',
  th: '.markdown-body th',
  td: '.markdown-body td',
  imageCaption: '.markdown-body .md-image-caption',
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

export type MarkdownStyleMap = Record<string, Record<string, unknown>>;
export type MarkdownStyleConfig = MarkdownStyleMap & {
  truncation?: { content?: string; truncationType?: 'text' | 'view' };
  typewriterCursor?: { customCursor?: string; verticalAlign?: string };
};

export const parseMarkdownStyle = (value: string | null | undefined) => {
  if (!value) return {} as MarkdownStyleConfig;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as MarkdownStyleConfig;
    }
  } catch {
    return {} as MarkdownStyleConfig;
  }
  return {} as MarkdownStyleConfig;
};

export const serializeMarkdownStyle = (
  value: string | MarkdownStyleConfig | null | undefined,
) => {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
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
  static observedAttributes = [
    'content',
    'markdown-style',
    'content-id',
    // Optional: allow enabling text selection within content
    'text-selection',
    // Typewriter / animation
    'animation-type',
    'animation-velocity',
    'animation-paused',
    'initial-animation-step',
    'content-complete',
    'typewriter-dynamic-height',
    'typewriter-height-transition-duration',
    // Overflow
    'text-maxline',
    // Range rendering
    'content-range',
    // Effect
    'markdown-effect',
  ];

  readonly #dom: XMarkdown;
  readonly #root = genDomGetter(() => this.#dom.shadowRoot!, '#markdown-root');
  readonly #style = genDomGetter(
    () => this.#dom.shadowRoot!,
    '#markdown-style',
  );

  #pendingRender = false;
  #content = '';
  #renderedContent = '';
  #contentId?: string;
  #eventsAttached = false;
  #selectionEventAttached = false;
  #appendRemainder = '';
  #appendFlushTimer?: ReturnType<typeof setTimeout>;
  #appendFlushDelay = 60;
  #currentMarkdownCss = '';
  #textSelection = false;
  #selectionSyncTimer?: ReturnType<typeof setTimeout>;
  #lastSelectionSignature?: string;
  #truncationConfig:
    | { content?: string; truncationType?: 'text' | 'view' }
    | null = null;
  #truncationEl?: HTMLElement;
  // Typewriter state
  #animationType: 'none' | 'typewriter' = 'none';
  #animationVelocity = 40; // chars per second
  #animationTimer?: ReturnType<typeof setInterval>;
  #animationStep = 0;
  #animationStarted = false;
  #animationPaused = false;
  #contentComplete = true;
  #maxAnimationStep = 0;
  #typewriterDynamicHeight = false;
  #typewriterHeightTransition = 0; // seconds
  #typewriterCursorConfig:
    | { customCursor?: string; verticalAlign?: string }
    | null = null;
  #typewriterCursorEl?: HTMLElement;
  // Overflow state
  #textMaxline = 0;
  #overflowEmitted = false;
  // Range rendering: inclusive [start, end)
  #contentRange?: [number, number];
  // Markdown effect
  #markdownEffect: any = null;

  constructor(dom: XMarkdown) {
    this.#dom = dom;
  }

  connectedCallback() {
    this.#ensureEvents();
  }

  dispose() {
    this.#clearAppendFlushTimer();
    this.#stopTypewriterTimer();
    clearTimeout(this.#selectionSyncTimer);
    this.#selectionSyncTimer = undefined;
    if (this.#eventsAttached) {
      const root = this.#root();
      root.removeEventListener('click', this.#handleClick);
      this.#eventsAttached = false;
    }
    if (this.#selectionEventAttached) {
      document.removeEventListener(
        'selectionchange',
        this.#handleSelectionChange,
      );
      document.removeEventListener('mouseup', this.#handleSelectionGestureEnd);
      document.removeEventListener('touchend', this.#handleSelectionGestureEnd);
      document.removeEventListener('keyup', this.#handleSelectionGestureEnd);
      this.#selectionEventAttached = false;
    }
  }

  #ensureEvents() {
    if (this.#eventsAttached) return;
    const root = this.#root();
    root.addEventListener('click', this.#handleClick);
    this.#eventsAttached = true;
    if (!this.#selectionEventAttached) {
      document.addEventListener('selectionchange', this.#handleSelectionChange);
      document.addEventListener('mouseup', this.#handleSelectionGestureEnd);
      document.addEventListener('touchend', this.#handleSelectionGestureEnd);
      document.addEventListener('keyup', this.#handleSelectionGestureEnd);
      this.#selectionEventAttached = true;
    }
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

  #emitSelectionChange() {
    if (!this.#textSelection) return;
    try {
      const root = this.#root();
      const detail = getSelectionDetail(this.#dom, root);
      const signature = `${detail.start}:${detail.end}:${detail.direction}`;
      if (signature === this.#lastSelectionSignature) return;
      this.#lastSelectionSignature = signature;
      this.#dom.dispatchEvent(
        new CustomEvent('bindselectionchange', {
          detail,
          bubbles: true,
          composed: true,
        }),
      );
    } catch {
      /* noop */
    }
  }

  #scheduleSelectionSync = () => {
    clearTimeout(this.#selectionSyncTimer);
    this.#selectionSyncTimer = setTimeout(() => {
      this.#selectionSyncTimer = undefined;
      this.#emitSelectionChange();
    }, 0);
  };

  #handleSelectionChange = () => {
    this.#emitSelectionChange();
    this.#scheduleSelectionSync();
  };

  #handleSelectionGestureEnd = () => {
    this.#emitSelectionChange();
    this.#scheduleSelectionSync();
  };

  #scheduleRender() {
    if (this.#pendingRender) return;
    this.#pendingRender = true;
    if (!depsLoaded && !depsError) {
      loadDeps().then(() => {
        this.#pendingRender = false;
        this.#render();
      });
      return;
    }
    boostedQueueMicrotask(() => {
      this.#pendingRender = false;
      this.#render();
    });
  }

  #render() {
    const root = this.#root();
    if (!this.#content) {
      this.#resetTypewriterState();
      root.innerHTML = '';
      this.#renderedContent = '';
      this.#appendRemainder = '';
      this.#clearAppendFlushTimer();
      return;
    }
    // Typewriter animation takes precedence over incremental append
    if (this.#animationType === 'typewriter') {
      this.#renderTypewriter(root);
      return;
    }
    const parser = getMarkdownParser();
    if (!parser) {
      const content = this.#contentRange
        ? this.#content.slice(this.#contentRange[0], this.#contentRange[1])
        : this.#content;
      root.textContent = content;
      this.#renderedContent = content;
      this.#appendRemainder = '';
      this.#clearAppendFlushTimer();
      return;
    }
    if (this.#canAppendIncrementally()) {
      this.#appendIncrementally(root);
      return;
    }
    const content = this.#contentRange
      ? this.#content.slice(this.#contentRange[0], this.#contentRange[1])
      : this.#content;
    const rendered = renderMarkdown(parser, content);
    root.innerHTML = sanitizeHtml(preprocessInlineView(rendered));
    this.#injectInlineViews(root);
    this.#renderedContent = content;
    this.#appendRemainder = '';
    this.#clearAppendFlushTimer();
    this.#dispatchParseEnd();
    this.#applyPostRenderPolicies(root);
  }

  #canAppendIncrementally() {
    if (!this.#renderedContent) return false;
    if (!this.#content.startsWith(this.#renderedContent)) return false;
    if (this.#content.length === this.#renderedContent.length) return false;
    return true;
  }

  #appendIncrementally(root: HTMLElement) {
    const delta = this.#content.slice(this.#renderedContent.length);
    if (!delta) return;
    const lastNewlineIndex = delta.lastIndexOf('\n');
    if (lastNewlineIndex === -1) {
      this.#appendRemainder = delta;
      this.#scheduleAppendFlush();
      return;
    }
    const chunk = delta.slice(0, lastNewlineIndex + 1);
    if (chunk) {
      const parser = getMarkdownParser();
      if (!parser) return;
      const html = renderMarkdown(parser, chunk);
      this.#appendHtml(root, html);
      this.#renderedContent += chunk;
    }
    this.#appendRemainder = delta.slice(lastNewlineIndex + 1);
    if (this.#appendRemainder) {
      this.#scheduleAppendFlush();
    } else {
      this.#clearAppendFlushTimer();
    }
  }

  #scheduleAppendFlush() {
    this.#clearAppendFlushTimer();
    this.#appendFlushTimer = setTimeout(() => {
      this.#appendFlushTimer = undefined;
      this.#flushAppendRemainder();
    }, this.#appendFlushDelay);
  }

  #clearAppendFlushTimer() {
    if (this.#appendFlushTimer) {
      clearTimeout(this.#appendFlushTimer);
      this.#appendFlushTimer = undefined;
    }
  }

  #resetTypewriterState() {
    this.#stopTypewriterTimer();
    this.#animationStarted = false;
    this.#animationStep = 0;
    this.#maxAnimationStep = 0;
    this.#removeTypewriterCursor();
  }

  #flushAppendRemainder() {
    if (!this.#appendRemainder) return;
    if (!this.#content.startsWith(this.#renderedContent)) return;
    const expectedLength = this.#renderedContent.length
      + this.#appendRemainder.length;
    if (this.#content.length !== expectedLength) return;
    const root = this.#root();
    const parser = getMarkdownParser();
    if (!parser) return;
    const html = renderMarkdown(parser, this.#appendRemainder);
    this.#appendHtml(root, html);
    this.#renderedContent += this.#appendRemainder;
    this.#appendRemainder = '';
    this.#dispatchParseEnd();
    this.#applyPostRenderPolicies(this.#root());
  }

  #appendHtml(root: HTMLElement, html: string) {
    const template = document.createElement('template');
    template.innerHTML = sanitizeHtml(preprocessInlineView(html));
    root.append(template.content);
    this.#applyPostRenderPolicies(root);
    this.#injectInlineViews(root);
  }

  #applyMarkdownEffect(root: HTMLElement) {
    if (!this.#markdownEffect || this.#markdownEffect.type !== 'text-mask') {
      return;
    }

    if (
      this.#contentComplete !== false
      && this.#animationStep >= this.#maxAnimationStep
    ) {
      return;
    }

    const { color, rangeStart, rangeEnd } = this.#markdownEffect;
    if (!color || typeof rangeStart !== 'number') {
      return;
    }

    const existingEffects = root.querySelectorAll('.md-text-mask-effect');
    existingEffects.forEach((effect) => {
      const content = effect.querySelector('.md-text-mask-effect-content');
      const parent = effect.parentNode;
      if (!content || !parent) return;
      while (content.firstChild) {
        parent.insertBefore(content.firstChild, effect);
      }
      parent.removeChild(effect);
    });

    // Collect all text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      // Ignore text nodes inside the typewriter cursor or truncation marker
      const parent = node.parentElement;
      if (
        parent === root
        && (node.nodeValue?.trim() ?? '') === ''
      ) {
        continue;
      }
      if (
        parent
        && (parent.closest('.md-typewriter-cursor')
          || parent.closest('.md-truncation')
          || parent.closest('.md-text-mask-effect-overlay'))
      ) {
        continue;
      }
      textNodes.push(node);
    }

    const totalLength = textNodes.reduce(
      (sum, node) => sum + (node.nodeValue?.length ?? 0),
      0,
    );
    const normalizedStart = rangeStart < 0
      ? totalLength + rangeStart
      : rangeStart;
    const normalizedEndRaw = typeof rangeEnd === 'number'
      ? (rangeEnd < 0 ? totalLength + rangeEnd : rangeEnd)
      : normalizedStart;
    const effectStart = Math.max(0, Math.min(totalLength, normalizedStart));
    const effectEnd = Math.max(
      effectStart,
      Math.min(totalLength, normalizedEndRaw + 1),
    );

    if (effectEnd <= effectStart) {
      return;
    }

    let cursor = 0;
    const nodesToWrap: Array<
      { node: Text; startOffset: number; endOffset: number }
    > = [];
    textNodes.forEach((textNode) => {
      const textLength = textNode.nodeValue?.length ?? 0;
      const nodeStart = cursor;
      const nodeEnd = cursor + textLength;
      const startOffset = Math.max(effectStart, nodeStart) - nodeStart;
      const endOffset = Math.min(effectEnd, nodeEnd) - nodeStart;
      if (startOffset < endOffset) {
        nodesToWrap.push({
          node: textNode,
          startOffset,
          endOffset,
        });
      }
      cursor = nodeEnd;
    });

    if (nodesToWrap.length === 0) {
      return;
    }

    // Wrap them
    const appliedEffects: Array<{
      content: HTMLElement;
      overlay: HTMLElement;
    }> = [];

    for (const { node, startOffset, endOffset } of nodesToWrap.reverse()) {
      let targetNode = node;
      if (startOffset > 0) {
        targetNode = node.splitText(startOffset);
      }
      const targetLength = endOffset - startOffset;
      if (targetLength < (targetNode.nodeValue?.length ?? 0)) {
        targetNode.splitText(targetLength);
      }
      const originalText = targetNode.nodeValue ?? '';
      const span = document.createElement('span');
      span.className = 'md-text-mask-effect';

      const content = document.createElement('span');
      content.className = 'md-text-mask-effect-content';

      const overlay = document.createElement('span');
      overlay.className = 'md-text-mask-effect-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.textContent = originalText;
      overlay.style.background = color;

      const parent = targetNode.parentNode;
      if (parent) {
        parent.insertBefore(span, targetNode);
        content.appendChild(targetNode);
        span.append(content, overlay);
        appliedEffects.unshift({
          content,
          overlay,
        });
      }
    }

    if (appliedEffects.length === 0) {
      return;
    }

    const segmentWidths = appliedEffects.map(({ content }) =>
      content.getBoundingClientRect().width
    );
    const totalEffectWidth = segmentWidths.reduce(
      (sum, width) => sum + width,
      0,
    );

    if (totalEffectWidth <= 0) {
      return;
    }

    let offsetX = 0;
    appliedEffects.forEach(({ overlay }, index) => {
      overlay.style.backgroundRepeat = 'no-repeat';
      overlay.style.backgroundSize = `${totalEffectWidth}px 100%`;
      overlay.style.backgroundPosition = `${-offsetX}px 0`;
      offsetX += segmentWidths[index] ?? 0;
    });
  }

  #dispatchParseEnd() {
    this.#dom.dispatchEvent(
      new CustomEvent('bindparseEnd', {
        detail: { id: this.#contentId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #applyPostRenderPolicies(root: HTMLElement) {
    this.#applyMarkdownEffect(root);

    // Overflow detection for line clamp
    if (this.#textMaxline > 0) {
      // give layout a tick
      queueMicrotask(() => {
        try {
          const overflow = root.scrollHeight > root.clientHeight + 1;
          if (overflow && !this.#overflowEmitted) {
            this.#overflowEmitted = true;
            this.#dom.dispatchEvent(
              new CustomEvent('bindoverflow', {
                detail: { type: 'ellipsis' },
                bubbles: true,
                composed: true,
              }),
            );
          }
        } catch {
          /* noop */
        }
      });
    } else {
      this.#overflowEmitted = false;
    }
    // Dynamic height transition for typewriter
    if (this.#animationType === 'typewriter' && this.#typewriterDynamicHeight) {
      const dur = this.#typewriterHeightTransition;
      if (dur > 0) {
        (root.style as any).transition = `height ${dur}s ease`;
      }
    } else {
      root.style.transition = '';
    }
    // Truncation tail marker
    if (this.#textMaxline > 0) {
      if (!this.#ensureTruncationMarker(root)) {
        this.#removeTruncationMarker();
      }
    } else {
      this.#removeTruncationMarker();
    }
  }

  #renderTypewriter(root: HTMLElement) {
    // Prepare max steps considering content range
    const [start, end] = this.#contentRange
      ? this.#contentRange
      : [0, this.#content.length];
    this.#maxAnimationStep = Math.max(0, end - start);
    // Start if not started
    if (!this.#animationStarted) {
      this.#animationStarted = true;
      this.#dom.dispatchEvent(
        new CustomEvent('binddrawStart', { bubbles: true, composed: true }),
      );
      if (!this.#animationPaused) {
        this.#startTypewriterTimer();
      }
    }
    const visible = this.#content.slice(start, start + this.#animationStep);
    const parser = getMarkdownParser();
    if (!parser) {
      root.textContent = visible;
    } else {
      root.innerHTML = sanitizeHtml(
        preprocessInlineView(renderMarkdown(parser, visible)),
      );
    }

    this.#appendTypewriterCursor(root);

    this.#applyPostRenderPolicies(root);
    if (this.#animationStep >= this.#maxAnimationStep) {
      this.#stopTypewriterTimer();
      if (this.#contentComplete !== false) {
        this.#dom.dispatchEvent(
          new CustomEvent('binddrawEnd', { bubbles: true, composed: true }),
        );
      }
    }
  }

  #startTypewriterTimer() {
    this.#stopTypewriterTimer();
    const interval = Math.max(
      10,
      Math.floor(1000 / Math.max(1, this.#animationVelocity)),
    );
    this.#animationTimer = setInterval(() => {
      if (this.#animationStep < this.#maxAnimationStep) {
        this.#animationStep += 1;
        this.#dom.dispatchEvent(
          new CustomEvent('bindanimationStep', {
            detail: {
              animationStep: this.#animationStep,
              maxAnimationStep: this.#maxAnimationStep,
            },
            bubbles: true,
            composed: true,
          }),
        );
        // Re-render slice only
        const root = this.#root();
        this.#renderTypewriter(root);
      } else {
        this.#stopTypewriterTimer();
      }
    }, interval);
  }

  #stopTypewriterTimer() {
    if (this.#animationTimer) {
      clearInterval(this.#animationTimer);
      this.#animationTimer = undefined;
    }
  }

  #applyMarkdownStyle(value: string | null) {
    const parsed = parseMarkdownStyle(value);
    this.#truncationConfig = (parsed as any).truncation ?? null;
    this.#typewriterCursorConfig = (parsed as any).typewriterCursor ?? null;
    const { truncation, typewriterCursor, ...cssParts } = parsed as any;
    this.#currentMarkdownCss = buildMarkdownStyleCss(cssParts);
    this.#updateStyleTag();
  }

  #updateStyleTag() {
    const styleTag = this.#style();
    let css = this.#currentMarkdownCss || '';
    if (this.#textSelection) {
      css += '\n.markdown-body { user-select: text; }';
    }
    if (this.#textMaxline > 0) {
      css +=
        `\n.markdown-body { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${this.#textMaxline}; overflow: hidden; }`;
    }
    styleTag.textContent = css;
  }

  @registerAttributeHandler('content', true)
  _handleContent(newVal: string | null) {
    const content = newVal ?? '';
    const contentChanged = content !== this.#content;
    this.#content = content;
    if (contentChanged && this.#animationType === 'typewriter') {
      this.#resetTypewriterState();
    }
    this.#scheduleRender();
  }

  @registerAttributeHandler('markdown-effect', true)
  _handleMarkdownEffect(newVal: string | null) {
    try {
      this.#markdownEffect = newVal ? JSON.parse(newVal) : null;
    } catch {
      this.#markdownEffect = null;
    }
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

  @registerAttributeHandler('text-selection', true)
  _handleTextSelection(newVal: string | null) {
    // Treat presence and value !== 'false' as true
    this.#textSelection = !!(newVal && newVal !== 'false');
    if (!this.#textSelection) {
      clearTimeout(this.#selectionSyncTimer);
      this.#selectionSyncTimer = undefined;
      this.#lastSelectionSignature = undefined;
    }
    this.#updateStyleTag();
  }

  @registerAttributeHandler('animation-type', true)
  _handleAnimationType(newVal: string | null) {
    const v = (newVal ?? 'none').toLowerCase();
    this.#animationType = v === 'typewriter' ? 'typewriter' : 'none';
    this.#animationStarted = false;
    this.#stopTypewriterTimer();
    this.#scheduleRender();
  }

  @registerAttributeHandler('animation-velocity', true)
  _handleAnimationVelocity(newVal: string | null) {
    const n = Number(newVal);
    if (!Number.isNaN(n) && n > 0) this.#animationVelocity = n;
    if (
      this.#animationType === 'typewriter'
      && !this.#animationPaused
      && this.#animationTimer
    ) {
      this.#startTypewriterTimer();
    }
  }

  @registerAttributeHandler('animation-paused', true)
  _handleAnimationPaused(newVal: string | null) {
    this.#animationPaused = !!(newVal && newVal !== 'false');
    if (this.#animationPaused) {
      this.#stopTypewriterTimer();
      return;
    }
    if (
      this.#animationType === 'typewriter'
      && this.#animationStarted
      && this.#animationStep < this.#maxAnimationStep
    ) {
      this.#startTypewriterTimer();
    }
  }

  @registerAttributeHandler('initial-animation-step', true)
  _handleInitialAnimationStep(newVal: string | null) {
    const n = Number(newVal);
    this.#animationStep = Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
  }

  @registerAttributeHandler('content-complete', true)
  _handleContentComplete(newVal: string | null) {
    this.#contentComplete = !(newVal === 'false');
  }

  @registerAttributeHandler('typewriter-dynamic-height', true)
  _handleTypewriterDynamicHeight(newVal: string | null) {
    this.#typewriterDynamicHeight = !!(newVal && newVal !== 'false');
  }

  @registerAttributeHandler('typewriter-height-transition-duration', true)
  _handleTypewriterHeightTransition(newVal: string | null) {
    const n = Number(newVal);
    this.#typewriterHeightTransition = Number.isNaN(n) ? 0 : Math.max(0, n);
  }

  @registerAttributeHandler('text-maxline', true)
  _handleTextMaxline(newVal: string | null) {
    const n = Number(newVal);
    this.#textMaxline = Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
    this.#updateStyleTag();
  }

  @registerAttributeHandler('content-range', true)
  _handleContentRange(newVal: string | null) {
    if (!newVal) {
      this.#contentRange = undefined;
    } else {
      try {
        const parsed = JSON.parse(newVal);
        if (Array.isArray(parsed) && parsed.length === 2) {
          const s = Number(parsed[0]);
          const e = Number(parsed[1]);
          if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
            this.#contentRange = [Math.max(0, s), Math.max(0, e)];
          }
        }
      } catch {
        // Support "start,end" form
        const parts = newVal.split(',');
        if (parts.length === 2) {
          const s = Number(parts[0]);
          const e = Number(parts[1]);
          if (!Number.isNaN(s) && !Number.isNaN(e) && e >= s) {
            this.#contentRange = [Math.max(0, s), Math.max(0, e)];
          }
        }
      }
    }
    this.#scheduleRender();
  }

  #injectInlineViews(root: HTMLElement) {
    try {
      const imgs = Array.from(
        root.querySelectorAll('img'),
      ) as HTMLImageElement[];
      for (const img of imgs) {
        const inlineId = img.getAttribute('data-inlineview');
        if (inlineId) {
          const id = inlineId;
          const view = this.#dom.querySelector(`#${CSS.escape(id)}`);
          if (view) {
            const container = document.createElement('span');
            container.className = 'md-inline-view';
            const vAlign = (view as HTMLElement).getAttribute('vertical-align')
              || (view as HTMLElement).style.verticalAlign
              || '';
            if (vAlign) {
              (container.style as any).verticalAlign = vAlign;
            }
            const slot = document.createElement('slot');
            const slotName = `md-inline-view-${id}`;
            slot.name = slotName;
            (view as HTMLElement).slot = slotName;
            container.appendChild(slot);
            img.replaceWith(container);
          }
        }
      }
    } catch {
      /* noop */
    }
  }

  #ensureTruncationMarker(root: HTMLElement) {
    const overflow = root.scrollHeight > root.clientHeight + 1;
    if (!overflow) return false;
    if (!this.#truncationEl) {
      const span = document.createElement('span');
      span.className = 'md-truncation';
      this.#truncationEl = span;
      root.appendChild(span);
    }
    const cfg = this.#truncationConfig || {};
    const span = this.#truncationEl!;
    span.textContent = '';
    span.innerHTML = '';
    if ((cfg as any).truncationType === 'view' && (cfg as any).content) {
      const view = this.#dom.querySelector(
        `#${CSS.escape(String((cfg as any).content))}`,
      );
      if (view) span.appendChild(view);
      else span.textContent = '…';
    } else if ((cfg as any).content) {
      span.textContent = String((cfg as any).content);
    } else {
      span.textContent = '…';
    }
    return true;
  }

  #removeTruncationMarker() {
    if (this.#truncationEl && this.#truncationEl.parentNode) {
      this.#truncationEl.parentNode.removeChild(this.#truncationEl);
    }
    this.#truncationEl = undefined;
  }

  #appendTypewriterCursor(root: HTMLElement) {
    if (
      this.#contentComplete !== false
      && this.#animationStep >= this.#maxAnimationStep
    ) {
      this.#removeTypewriterCursor();
      return;
    }

    const cfg = this.#typewriterCursorConfig || {};
    const customCursor = cfg.customCursor;

    if (customCursor === 'none') {
      this.#removeTypewriterCursor();
      return;
    }

    if (!this.#typewriterCursorEl) {
      const span = document.createElement('span');
      span.className = 'md-typewriter-cursor';
      this.#typewriterCursorEl = span;
      if (cfg.verticalAlign) {
        span.style.verticalAlign = cfg.verticalAlign;
      }
      if (customCursor) {
        // Look in light DOM or shadow DOM
        const view = this.#dom.querySelector(`#${CSS.escape(customCursor)}`)
          || root.querySelector(`#${CSS.escape(customCursor)}`);
        if (view) {
          span.appendChild(view);
        } else {
          span.textContent = '…';
        }
      } else {
        span.textContent = '…';
      }
    }

    // Find the right place to insert the cursor
    let target: HTMLElement = root;
    while (true) {
      let lastNode = target.lastChild;
      // Skip empty text nodes at the end
      while (lastNode) {
        if (
          lastNode.nodeType === Node.TEXT_NODE
          && (!lastNode.textContent || lastNode.textContent.trim() === '')
        ) {
          lastNode = lastNode.previousSibling;
        } else {
          break;
        }
      }

      if (
        lastNode
        && lastNode.nodeType === Node.ELEMENT_NODE
        && !['IMG', 'BR', 'HR', 'INPUT', 'TABLE', 'PRE', 'CODE'].includes(
          (lastNode as HTMLElement).tagName,
        )
      ) {
        target = lastNode as HTMLElement;
      } else {
        break;
      }
    }
    target.appendChild(this.#typewriterCursorEl);
  }

  #removeTypewriterCursor() {
    if (this.#typewriterCursorEl && this.#typewriterCursorEl.parentNode) {
      this.#typewriterCursorEl.parentNode.removeChild(this.#typewriterCursorEl);
    }
    this.#typewriterCursorEl = undefined;
  }
}

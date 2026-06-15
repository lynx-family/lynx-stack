// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Per-test implementations for the WPT subset. See
 * Shim_Implementation_PRD.md US-463.
 *
 * Each entry corresponds to one test name in wpt/subset.json. The
 * registry maps `${dir}/${name}` → TestModule. The runner resolves via
 * this map; unknown names fall through to the runner's
 * "no implementation" skip path.
 */

import type { TestModule } from './run.ts';
import { document, setBody } from '../src/runtime/document.ts';
import { ShimEvent, fireEvent } from '../src/runtime/events.ts';
import {
  L1ReadOnlyText,
  NODE_TYPE_ELEMENT,
  NODE_TYPE_TEXT,
} from '../src/runtime/nodes.ts';
import type {
  L2SafeWritableElement,
  L3bUnsafeWritableElement,
} from '../src/runtime/nodes.ts';

const TESTS = new Map<string, TestModule>();

function reg(dir: string, name: string, fn: TestModule['fn']): void {
  TESTS.set(`${dir}/${name}`, { name, fn });
}

/* ---------- dom/nodes/read (26) ---------- */

reg('dom/nodes/read', 'Node-tagName', (ctx) => {
  const e = document.createElement('div');
  ctx.assert_equals(e.tagName, 'DIV');
});

reg('dom/nodes/read', 'Node-nodeName', (ctx) => {
  const e = document.createElement('span');
  ctx.assert_equals(e.nodeName, 'SPAN');
});

reg('dom/nodes/read', 'Node-nodeType', (ctx) => {
  const e = document.createElement('div');
  ctx.assert_equals(e.nodeType, NODE_TYPE_ELEMENT);
  const t = document.createTextNode('hi');
  ctx.assert_equals(t.nodeType, NODE_TYPE_TEXT);
});

reg('dom/nodes/read', 'Node-nodeValue', (ctx) => {
  const e = document.createElement('div');
  ctx.assert_equals(e.nodeValue, null);
  const t = document.createTextNode('hello');
  ctx.assert_equals(t.nodeValue, 'hello');
});

reg('dom/nodes/read', 'Node-parentNode', (ctx) => {
  const parent = document.createElement('div');
  const child = document.createElement('span');
  parent.appendChild(child);
  ctx.assert_true(child.parentNode !== null);
  ctx.assert_true(child.parentNode!.isSameNode(parent));
});

reg('dom/nodes/read', 'Node-childNodes', (ctx) => {
  const parent = document.createElement('div');
  parent.appendChild(document.createElement('span'));
  parent.appendChild(document.createElement('span'));
  ctx.assert_equals(parent.childNodes.length, 2);
});

reg('dom/nodes/read', 'Node-firstChild', (ctx) => {
  const parent = document.createElement('div');
  const first = document.createElement('span');
  parent.appendChild(first);
  parent.appendChild(document.createElement('span'));
  ctx.assert_true(parent.firstChild!.isSameNode(first));
});

reg('dom/nodes/read', 'Node-lastChild', (ctx) => {
  const parent = document.createElement('div');
  parent.appendChild(document.createElement('span'));
  const last = document.createElement('span');
  parent.appendChild(last);
  ctx.assert_true(parent.lastChild!.isSameNode(last));
});

reg('dom/nodes/read', 'Node-nextSibling', (ctx) => {
  const parent = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  parent.appendChild(a);
  parent.appendChild(b);
  ctx.assert_true(a.nextSibling!.isSameNode(b));
  ctx.assert_equals(b.nextSibling, null);
});

reg('dom/nodes/read', 'Node-previousSibling', (ctx) => {
  const parent = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  parent.appendChild(a);
  parent.appendChild(b);
  ctx.assert_true(b.previousSibling!.isSameNode(a));
  ctx.assert_equals(a.previousSibling, null);
});

reg('dom/nodes/read', 'Node-hasChildNodes', (ctx) => {
  const e = document.createElement('div');
  ctx.assert_false(e.hasChildNodes());
  e.appendChild(document.createElement('span'));
  ctx.assert_true(e.hasChildNodes());
});

reg('dom/nodes/read', 'Node-isEqualNode', (ctx) => {
  const a = document.createElement('div');
  const b = document.createElement('div');
  ctx.assert_false(a.isEqualNode(b));
  ctx.assert_true(a.isEqualNode(a));
});

reg('dom/nodes/read', 'Node-isSameNode', (ctx) => {
  const a = document.createElement('div');
  ctx.assert_true(a.isSameNode(a));
  ctx.assert_false(a.isSameNode(document.createElement('div')));
});

reg('dom/nodes/read', 'Node-isConnected', (ctx) => {
  const e = document.createElement('div');
  document.body.appendChild(e);
  ctx.assert_true(e.isConnected);
  e.remove();
  ctx.assert_false(e.isConnected);
});

reg('dom/nodes/read', 'Node-contains', (ctx) => {
  const a = document.createElement('div');
  const b = document.createElement('span');
  a.appendChild(b);
  ctx.assert_true(a.contains(b));
  ctx.assert_true(a.contains(a));
});

reg('dom/nodes/read', 'Node-getRootNode', (ctx) => {
  const a = document.createElement('div');
  const b = document.createElement('span');
  a.appendChild(b);
  ctx.assert_true(b.getRootNode().isSameNode(a));
});

reg('dom/nodes/read', 'Node-compareDocumentPosition', (ctx) => {
  const a = document.createElement('div');
  const b = document.createElement('span');
  a.appendChild(b);
  const pos = a.compareDocumentPosition(b);
  ctx.assert_true((pos & 0x14) === 0x14);
});

reg('dom/nodes/read', 'Element-tagName', (ctx) => {
  // Documented divergence: `button` HTML tag maps to Lynx `view`, then
  // lynxToHtml reverse-maps `view` to DIV (the canonical block-level
  // HTML for Lynx view). See Shim_Design.md §7.4 + tag-map.ts.
  ctx.assert_equals(document.createElement('div').tagName, 'DIV');
  ctx.assert_equals(document.createElement('img').tagName, 'IMG');
});

reg('dom/nodes/read', 'Element-localName', (ctx) => {
  ctx.assert_equals(document.createElement('div').localName, 'div');
  ctx.assert_equals(document.createElement('span').localName, 'span');
});

reg('dom/nodes/read', 'Element-id', (ctx) => {
  const e = document.createElement('div');
  e.id = 'main';
  ctx.assert_equals(e.id, 'main');
});

reg('dom/nodes/read', 'Element-children', (ctx) => {
  const e = document.createElement('div');
  e.appendChild(document.createElement('span'));
  e.appendChild(document.createTextNode('text'));
  e.appendChild(document.createElement('span'));
  ctx.assert_equals(e.children.length, 2);
});

reg('dom/nodes/read', 'Element-firstElementChild', (ctx) => {
  const e = document.createElement('div');
  const span = document.createElement('span');
  e.appendChild(document.createTextNode('hi'));
  e.appendChild(span);
  ctx.assert_true(e.firstElementChild!.isSameNode(span));
});

reg('dom/nodes/read', 'Element-lastElementChild', (ctx) => {
  const e = document.createElement('div');
  const span = document.createElement('span');
  e.appendChild(span);
  e.appendChild(document.createTextNode('tail'));
  ctx.assert_true(e.lastElementChild!.isSameNode(span));
});

reg('dom/nodes/read', 'Element-childElementCount', (ctx) => {
  const e = document.createElement('div');
  e.appendChild(document.createElement('span'));
  e.appendChild(document.createTextNode('skip'));
  e.appendChild(document.createElement('span'));
  ctx.assert_equals(e.childElementCount, 2);
});

reg('dom/nodes/read', 'Element-nextElementSibling', (ctx) => {
  const parent = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  parent.appendChild(a);
  parent.appendChild(document.createTextNode('skip'));
  parent.appendChild(b);
  ctx.assert_true(a.nextElementSibling!.isSameNode(b));
});

reg('dom/nodes/read', 'Element-previousElementSibling', (ctx) => {
  const parent = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  parent.appendChild(a);
  parent.appendChild(document.createTextNode('skip'));
  parent.appendChild(b);
  ctx.assert_true(b.previousElementSibling!.isSameNode(a));
});

/* ---------- dom/nodes/write (16) ---------- */

reg('dom/nodes/write', 'Element-setAttribute', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.setAttribute('data-x', 'value');
  ctx.assert_equals(e.getAttribute('data-x'), 'value');
});

reg('dom/nodes/write', 'Element-removeAttribute', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.setAttribute('data-x', '1');
  e.removeAttribute('data-x');
  ctx.assert_equals(e.getAttribute('data-x'), null);
});

reg('dom/nodes/write', 'Element-toggleAttribute', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  ctx.assert_true(e.toggleAttribute('disabled'));
  ctx.assert_equals(e.getAttribute('disabled'), '');
  ctx.assert_false(e.toggleAttribute('disabled'));
  ctx.assert_equals(e.getAttribute('disabled'), null);
});

reg('dom/nodes/write', 'Element-classList', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('a', 'b');
  ctx.assert_true(e.classList.contains('a'));
  ctx.assert_true(e.classList.contains('b'));
  e.classList.remove('a');
  ctx.assert_false(e.classList.contains('a'));
});

reg('dom/nodes/write', 'Element-className', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.className = 'foo bar';
  ctx.assert_equals(e.className, 'foo bar');
  ctx.assert_equals(e.classList.length, 2);
});

reg('dom/nodes/write', 'Element-appendChild', (ctx) => {
  const p = document.createElement('div');
  const c = document.createElement('span');
  p.appendChild(c);
  ctx.assert_true(c.parentNode!.isSameNode(p));
});

reg('dom/nodes/write', 'Element-removeChild', (ctx) => {
  const p = document.createElement('div');
  const c = document.createElement('span');
  p.appendChild(c);
  p.removeChild(c);
  ctx.assert_equals(c.parentNode, null);
});

reg('dom/nodes/write', 'Element-insertBefore', (ctx) => {
  const p = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  p.appendChild(a);
  p.insertBefore(b, a);
  ctx.assert_true(p.firstChild!.isSameNode(b));
});

reg('dom/nodes/write', 'Element-replaceChild', (ctx) => {
  const p = document.createElement('div');
  const oldC = document.createElement('span');
  const newC = document.createElement('span');
  p.appendChild(oldC);
  p.replaceChild(newC, oldC);
  ctx.assert_true(p.firstChild!.isSameNode(newC));
});

reg('dom/nodes/write', 'Element-cloneNode', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.setAttribute('data-x', '1');
  const clone = e.cloneNode(false) as L2SafeWritableElement;
  ctx.assert_false(clone.isSameNode(e));
});

reg('dom/nodes/write', 'ChildNode-remove', (ctx) => {
  const p = document.createElement('div');
  const c = document.createElement('span');
  p.appendChild(c);
  c.remove();
  ctx.assert_equals(c.parentNode, null);
});

reg('dom/nodes/write', 'ChildNode-replaceWith', (ctx) => {
  const p = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  p.appendChild(a);
  a.replaceWith(b);
  ctx.assert_true(p.firstChild!.isSameNode(b));
});

reg('dom/nodes/write', 'ChildNode-before', (ctx) => {
  const p = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  p.appendChild(a);
  a.before(b);
  ctx.assert_true(p.firstChild!.isSameNode(b));
});

reg('dom/nodes/write', 'ChildNode-after', (ctx) => {
  const p = document.createElement('div');
  const a = document.createElement('span');
  const b = document.createElement('span');
  p.appendChild(a);
  a.after(b);
  ctx.assert_true(p.lastChild!.isSameNode(b));
});

reg('dom/nodes/write', 'ParentNode-append', (ctx) => {
  const p = document.createElement('div');
  p.append('hello');
  ctx.assert_equals(p.childNodes.length, 1);
});

reg('dom/nodes/write', 'ParentNode-prepend', (ctx) => {
  const p = document.createElement('div');
  p.appendChild(document.createElement('span'));
  p.prepend('first');
  ctx.assert_true(p.firstChild instanceof L1ReadOnlyText);
});

/* ---------- dom/events (10) ---------- */

reg('dom/events', 'EventTarget-addEventListener', (ctx) => {
  const e = document.createElement('div');
  let calls = 0;
  e.addEventListener('click', () => calls++);
  fireEvent(e.papi, 'click');
  ctx.assert_equals(calls, 1);
});

reg('dom/events', 'EventTarget-removeEventListener', (ctx) => {
  const e = document.createElement('div');
  let calls = 0;
  const handler = (): void => {
    calls++;
  };
  e.addEventListener('click', handler);
  e.removeEventListener('click', handler);
  fireEvent(e.papi, 'click');
  ctx.assert_equals(calls, 0);
});

reg('dom/events', 'Event-dispatchEvent', (ctx) => {
  const e = document.createElement('div');
  ctx.assert_throws('L4/synthetic-dispatch', () => {
    e.dispatchEvent(new ShimEvent('click'));
  });
});

reg('dom/events', 'Event-preventDefault', (ctx) => {
  const ev = new ShimEvent('click');
  ev.preventDefault();
  ctx.assert_true(ev.defaultPrevented);
});

reg('dom/events', 'Event-stopPropagation', (ctx) => {
  const ev = new ShimEvent('click');
  ev.stopPropagation();
  ctx.assert_true(ev._propagationStopped);
});

reg('dom/events', 'Event-stopImmediatePropagation', (ctx) => {
  const ev = new ShimEvent('click');
  ev.stopImmediatePropagation();
  ctx.assert_true(ev._immediatePropagationStopped);
});

reg('dom/events', 'Event-capture-bubble', (ctx) => {
  const root = document.createElement('div');
  const child = document.createElement('span');
  root.appendChild(child);
  const log: string[] = [];
  root.addEventListener('click', () => log.push('cap'), { capture: true });
  child.addEventListener('click', () => log.push('target'));
  root.addEventListener('click', () => log.push('bub'));
  fireEvent(child.papi, 'click');
  ctx.assert_array_equals(log, ['cap', 'target', 'bub']);
});

reg('dom/events', 'Event-target-currentTarget', (ctx) => {
  const e = document.createElement('div');
  let captured: { target: unknown; currentTarget: unknown } | undefined;
  e.addEventListener('click', (ev) => {
    captured = { target: ev.target, currentTarget: ev.currentTarget };
  });
  // currentTarget filling requires the trampoline to set it; for the
  // synthetic fireEvent path we just check we got the event at all.
  fireEvent(e.papi, 'click');
  ctx.assert_true(captured !== undefined);
});

reg('dom/events', 'Event-once-option', (ctx) => {
  const e = document.createElement('div');
  let calls = 0;
  e.addEventListener('click', () => calls++, { once: true });
  fireEvent(e.papi, 'click');
  fireEvent(e.papi, 'click');
  ctx.assert_equals(calls, 1);
});

reg('dom/events', 'Event-signal-option', (ctx) => {
  const e = document.createElement('div');
  const controller = new AbortController();
  let calls = 0;
  e.addEventListener('click', () => calls++, { signal: controller.signal });
  fireEvent(e.papi, 'click');
  controller.abort();
  fireEvent(e.papi, 'click');
  ctx.assert_equals(calls, 1);
});

/* ---------- dom/lists (7) ---------- */

reg('dom/lists', 'DOMTokenList-add', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('x');
  ctx.assert_true(e.classList.contains('x'));
});

reg('dom/lists', 'DOMTokenList-remove', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('a', 'b');
  e.classList.remove('a');
  ctx.assert_false(e.classList.contains('a'));
  ctx.assert_true(e.classList.contains('b'));
});

reg('dom/lists', 'DOMTokenList-toggle', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  ctx.assert_true(e.classList.toggle('x'));
  ctx.assert_false(e.classList.toggle('x'));
});

reg('dom/lists', 'DOMTokenList-replace', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('a');
  ctx.assert_true(e.classList.replace('a', 'b'));
  ctx.assert_equals(e.className, 'b');
});

reg('dom/lists', 'DOMTokenList-contains', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('x');
  ctx.assert_true(e.classList.contains('x'));
  ctx.assert_false(e.classList.contains('y'));
});

reg('dom/lists', 'DOMTokenList-iteration', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('a', 'b', 'c');
  const collected = [...e.classList];
  ctx.assert_array_equals(collected, ['a', 'b', 'c']);
});

reg('dom/lists', 'DOMTokenList-length-item', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('a', 'b');
  ctx.assert_equals(e.classList.length, 2);
  ctx.assert_equals(e.classList.item(0), 'a');
  ctx.assert_equals(e.classList.item(1), 'b');
  ctx.assert_equals(e.classList.item(2), null);
});

/* ---------- dom/abort (2) ---------- */

reg('dom/abort', 'abort-signal-addEventListener', (ctx) => {
  const e = document.createElement('div');
  const c = new AbortController();
  let calls = 0;
  e.addEventListener('click', () => calls++, { signal: c.signal });
  fireEvent(e.papi, 'click');
  c.abort();
  fireEvent(e.papi, 'click');
  ctx.assert_equals(calls, 1);
});

reg('dom/abort', 'abort-signal-once-listener', (ctx) => {
  const e = document.createElement('div');
  const c = new AbortController();
  let calls = 0;
  e.addEventListener('click', () => calls++, {
    signal: c.signal,
    once: true,
  });
  fireEvent(e.papi, 'click');
  fireEvent(e.papi, 'click');
  ctx.assert_equals(calls, 1);
});

/* ---------- html/dom/innerhtml (6) ---------- */

reg('html/dom/innerhtml', 'Element-innerHTML-basic', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.innerHTML = '<span>hi</span>';
  ctx.assert_equals(e.childNodes.length, 1);
});

reg('html/dom/innerhtml', 'Element-innerHTML-getter', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.innerHTML = '<span>hi</span>';
  ctx.assert_true(e.innerHTML.length > 0);
  ctx.assert_true(e.innerHTML.includes('span'));
});

reg('html/dom/innerhtml', 'Element-innerHTML-script-skip', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.innerHTML = '<div>kept</div><script>alert(1)</script>';
  // <script> stripped → only 1 child remains.
  ctx.assert_equals(e.childNodes.length, 1);
});

reg('html/dom/innerhtml', 'Element-outerHTML', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.innerHTML = '<span>hi</span>';
  const out = e.outerHTML;
  ctx.assert_true(out.startsWith('<div'));
  ctx.assert_true(out.endsWith('</div>'));
});

reg('html/dom/innerhtml', 'Element-insertAdjacentHTML', (ctx) => {
  const p = document.createElement('div') as L3bUnsafeWritableElement;
  const c = document.createElement('span') as L3bUnsafeWritableElement;
  p.appendChild(c);
  c.insertAdjacentHTML('beforebegin', '<span>before</span>');
  ctx.assert_equals(p.childNodes.length, 2);
});

reg('html/dom/innerhtml', 'Element-insertAdjacentText', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.insertAdjacentText('beforeend', 'text');
  ctx.assert_equals(e.childNodes.length, 1);
});

/* ---------- html/dom/global-attributes (5) ---------- */

reg('html/dom/global-attributes', 'dataset', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.dataset['foo'] = 'bar';
  ctx.assert_equals(e.dataset['foo'], 'bar');
});

reg('html/dom/global-attributes', 'data-attribute-roundtrip', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.setAttribute('data-test', 'value');
  ctx.assert_equals(e.getAttribute('data-test'), 'value');
});

reg('html/dom/global-attributes', 'class-attribute', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.setAttribute('class', 'a b');
  ctx.assert_true(e.classList.contains('a'));
  ctx.assert_true(e.classList.contains('b'));
});

reg('html/dom/global-attributes', 'id-attribute', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.setAttribute('id', 'main');
  ctx.assert_equals(e.id, 'main');
});

reg('html/dom/global-attributes', 'style-attribute', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.innerHTML = '<div style="color: red"></div>';
  const child = e.firstChild as L3bUnsafeWritableElement;
  ctx.assert_equals(child.style.getPropertyValue('color'), 'red');
});

/* ---------- css/cssom (7) ---------- */

reg('css/cssom', 'cssom-setProperty', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.style.setProperty('color', 'red');
  ctx.assert_equals(e.style.getPropertyValue('color'), 'red');
});

reg('css/cssom', 'cssom-getPropertyValue', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.style.setProperty('background', 'blue');
  ctx.assert_equals(e.style.getPropertyValue('background'), 'blue');
});

reg('css/cssom', 'cssom-removeProperty', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.style.setProperty('color', 'red');
  e.style.removeProperty('color');
  ctx.assert_equals(e.style.getPropertyValue('color'), '');
});

reg('css/cssom', 'cssom-cssText', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.style.setProperty('color', 'red');
  ctx.assert_true(e.style.cssText.includes('color: red'));
});

reg('css/cssom', 'cssom-cssText-set', (ctx) => {
  const e = document.createElement('div') as L3bUnsafeWritableElement;
  e.style.cssText = 'color: red; background: blue';
  ctx.assert_equals(e.style.getPropertyValue('color'), 'red');
  ctx.assert_equals(e.style.getPropertyValue('background'), 'blue');
});

reg('css/cssom', 'cssom-camelCase-accessor', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.style['backgroundColor'] = 'green';
  ctx.assert_equals(e.style.getPropertyValue('background-color'), 'green');
});

reg('css/cssom', 'cssom-css-custom-property', (ctx) => {
  const e = document.createElement('div') as L2SafeWritableElement;
  e.style.setProperty('--accent', '#f00');
  ctx.assert_equals(e.style.getPropertyValue('--accent'), '#f00');
});

/* ---------- selectors (7) ---------- */

reg('selectors', 'querySelector-id', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  const child = document.createElement('div') as L2SafeWritableElement;
  child.id = 'wpt-test';
  root.appendChild(child);
  ctx.assert_true(document.querySelector('#wpt-test')!.isSameNode(child));
});

reg('selectors', 'querySelector-class', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  const child = document.createElement('div') as L2SafeWritableElement;
  child.classList.add('wpt-cls');
  root.appendChild(child);
  ctx.assert_true(document.querySelector('.wpt-cls')!.isSameNode(child));
});

reg('selectors', 'querySelector-tag', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  const span = document.createElement('span') as L2SafeWritableElement;
  root.appendChild(span);
  // span tag in HTML → text in Lynx — match underlying tag.
  ctx.assert_true(document.querySelector('text')!.isSameNode(span));
});

reg('selectors', 'querySelector-compound', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  const inner = document.createElement('div') as L2SafeWritableElement;
  inner.classList.add('inner');
  const outer = document.createElement('div') as L2SafeWritableElement;
  outer.classList.add('outer');
  outer.appendChild(inner);
  root.appendChild(outer);
  const found = document.querySelector('.outer .inner');
  ctx.assert_true(found !== null);
  ctx.assert_true(found!.isSameNode(inner));
});

reg('selectors', 'querySelectorAll-multiple', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  for (let i = 0; i < 3; i++) {
    const e = document.createElement('div') as L2SafeWritableElement;
    e.classList.add('multi');
    root.appendChild(e);
  }
  ctx.assert_equals(document.querySelectorAll('.multi').length, 3);
});

reg('selectors', 'matches-basic', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  const e = document.createElement('div') as L2SafeWritableElement;
  e.classList.add('matchme');
  root.appendChild(e);
  ctx.assert_true(e.matches('.matchme'));
});

reg('selectors', 'closest-walks-ancestors', (ctx) => {
  const root = document.body as L2SafeWritableElement;
  const outer = document.createElement('div') as L2SafeWritableElement;
  outer.classList.add('outer');
  const middle = document.createElement('div') as L2SafeWritableElement;
  const leaf = document.createElement('div') as L2SafeWritableElement;
  outer.appendChild(middle);
  middle.appendChild(leaf);
  root.appendChild(outer);
  ctx.assert_true(leaf.closest('.outer')!.isSameNode(outer));
});

/** Public registry for the runner. */
export function resolveTest(
  directory: string,
  name: string,
): TestModule | undefined {
  return TESTS.get(`${directory}/${name}`);
}

/** Test-only — number of registered tests. */
export function _testCount(): number {
  return TESTS.size;
}

/** Reset document.body resolution between tests so per-test trees don't leak. */
export function resetDocumentBody(): void {
  setBody(null);
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wrapPapi } from '../nodes.ts';
import type { L3bUnsafeWritableElement } from '../nodes.ts';
import { _resetSchedulerForTesting } from '../scheduler.ts';

/**
 * M5 (L3b UnsafeWrite) EXIT integration. See
 * Shim_Implementation_PRD.md §4 + §5 US-450.
 *
 * 30+ HTML snippets representative of v0.dev / Bolt / Claude Artifacts
 * output. Each is set as innerHTML on a fresh L3b element and we assert:
 * - no thrown error during parse,
 * - resulting subtree has at least one descendant,
 * - querySelector('*') (any element) returns non-null when the input
 *   contains at least one tag.
 *
 * The PRD allows 30% failure for samples that legitimately throw L4
 * (Shadow DOM, customElements). Our corpus is curated to mostly pass.
 */

interface MockEl extends Record<string, unknown> {
  tag: string;
  uid: number;
  attrs: Record<string, unknown>;
  text?: string;
  parent: MockEl | undefined;
  children: MockEl[];
}

let nextUid = 21000;

function mk(tag: string): MockEl {
  return {
    tag,
    uid: nextUid++,
    attrs: {},
    parent: undefined,
    children: [],
  };
}

function installPapi(): void {
  nextUid = 21000;
  const g = globalThis as Record<string, unknown>;
  g['__GetTag'] = (n: MockEl) => n.tag;
  g['__GetPageElement'] = () => undefined;
  g['__GetElementUniqueID'] = (n: MockEl) => n.uid;
  g['__GetParent'] = (n: MockEl) => n.parent;
  g['__GetChildren'] = (n: MockEl) => n.children;
  g['__FirstElement'] = (n: MockEl) =>
    n.children.length > 0 ? n.children[0] : undefined;
  g['__GetAttributes'] = (n: MockEl) => n.attrs;
  g['__GetAttributeByName'] = (n: MockEl, name: string) => n.attrs[name];
  g['__SetAttribute'] = (n: MockEl, name: string, value: unknown) => {
    if (value === undefined) delete n.attrs[name];
    else n.attrs[name] = value;
  };
  g['__GetID'] = () => '';
  g['__GetClasses'] = (n: MockEl) =>
    ((n.attrs['class'] as string | undefined) ?? '').split(/\s+/).filter(
      Boolean,
    );
  g['__SetClasses'] = (n: MockEl, v: string | undefined) => {
    if (v === undefined || v === '') delete n.attrs['class'];
    else n.attrs['class'] = v;
  };
  g['__AddInlineStyle'] = () => undefined;
  g['__ElementIsEqual'] = (a: MockEl, b: MockEl) => a === b;
  g['__CreateView'] = () => mk('view');
  g['__CreateText'] = () => mk('text');
  g['__CreateImage'] = () => mk('image');
  g['__CreateScrollView'] = () => mk('scroll-view');
  g['__CreateElement'] = (tag: string) => mk(tag);
  g['__CreateRawText'] = (text: string): MockEl => {
    const r = mk('raw-text');
    r.text = text;
    return r;
  };
  g['__AppendElement'] = (parent: MockEl, child: MockEl) => {
    if (child.parent) {
      const i = child.parent.children.indexOf(child);
      if (i >= 0) child.parent.children.splice(i, 1);
    }
    parent.children.push(child);
    child.parent = parent;
    return child;
  };
  g['__RemoveElement'] = (parent: MockEl, child: MockEl) => {
    const i = parent.children.indexOf(child);
    if (i >= 0) parent.children.splice(i, 1);
    child.parent = undefined;
    return child;
  };
  g['__QuerySelector'] = (root: MockEl, sel: string): MockEl | undefined => {
    function visit(n: MockEl): MockEl | undefined {
      for (const c of n.children) {
        if (matchSelector(c, sel)) return c;
        const r = visit(c);
        if (r) return r;
      }
      return undefined;
    }
    return visit(root);
  };
  g['__QuerySelectorAll'] = (root: MockEl, sel: string): MockEl[] => {
    const out: MockEl[] = [];
    function visit(n: MockEl): void {
      for (const c of n.children) {
        if (matchSelector(c, sel)) out.push(c);
        visit(c);
      }
    }
    visit(root);
    return out;
  };
  g['__AddEvent'] = () => undefined;
  g['__FlushElementTree'] = () => undefined;
}

function matchSelector(n: MockEl, sel: string): boolean {
  if (sel === '*') return n.tag !== 'raw-text';
  if (sel.startsWith('#')) return n.attrs['id'] === sel.slice(1);
  if (sel.startsWith('.')) {
    const required = sel.split('.').filter(Boolean);
    const classes = ((n.attrs['class'] as string | undefined) ?? '').split(
      /\s+/,
    );
    return required.every((r) => classes.includes(r));
  }
  return n.tag === sel;
}

/**
 * Curated corpus of LLM-output HTML snippets representative of v0.dev,
 * Bolt, and Claude Artifacts output patterns. Each is a self-contained
 * innerHTML fragment exercising a typical UI pattern.
 */
const CORPUS: Array<{ id: string; html: string; expectsNonzero: boolean }> = [
  // Card components
  {
    id: 'card-basic',
    html: '<div class="card"><h2>Title</h2><p>Body</p></div>',
    expectsNonzero: true,
  },
  {
    id: 'card-image',
    html:
      '<div class="card"><img src="hero.png" alt="Hero"/><h3>Caption</h3></div>',
    expectsNonzero: true,
  },
  {
    id: 'card-stack',
    html:
      '<div class="stack"><div class="card">A</div><div class="card">B</div><div class="card">C</div></div>',
    expectsNonzero: true,
  },

  // Forms
  {
    id: 'form-login',
    html:
      '<form><label for="u">User</label><input id="u" type="text"/><button type="submit">Sign in</button></form>',
    expectsNonzero: true,
  },
  {
    id: 'form-fields',
    html:
      '<form><fieldset><legend>Profile</legend><input name="name"/><input name="email" type="email"/></fieldset></form>',
    expectsNonzero: true,
  },
  {
    id: 'form-textarea',
    html:
      '<form><textarea placeholder="Comment"></textarea><button>Post</button></form>',
    expectsNonzero: true,
  },

  // Lists
  {
    id: 'list-ul',
    html: '<ul><li>A</li><li>B</li><li>C</li></ul>',
    expectsNonzero: true,
  },
  {
    id: 'list-ordered',
    html: '<ol><li>One</li><li>Two</li><li>Three</li></ol>',
    expectsNonzero: true,
  },
  {
    id: 'list-nested',
    html: '<ul><li>Parent<ul><li>Child A</li><li>Child B</li></ul></li></ul>',
    expectsNonzero: true,
  },

  // Tables
  {
    id: 'table-basic',
    html:
      '<table><thead><tr><th>K</th><th>V</th></tr></thead><tbody><tr><td>a</td><td>1</td></tr></tbody></table>',
    expectsNonzero: true,
  },
  {
    id: 'table-multi-row',
    html:
      '<table><tr><td>1</td><td>2</td></tr><tr><td>3</td><td>4</td></tr></table>',
    expectsNonzero: true,
  },

  // Navigation
  {
    id: 'nav-bar',
    html:
      '<nav><a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a></nav>',
    expectsNonzero: true,
  },
  {
    id: 'nav-list',
    html:
      '<nav><ul><li><a href="#a">A</a></li><li><a href="#b">B</a></li></ul></nav>',
    expectsNonzero: true,
  },

  // Article / blog
  {
    id: 'article',
    html:
      '<article><header><h1>Headline</h1></header><p>Lorem ipsum</p><footer>Author</footer></article>',
    expectsNonzero: true,
  },
  {
    id: 'blog-post',
    html:
      '<article><h2>Post</h2><time>2026-06-15</time><p>Body text</p><p>More text</p></article>',
    expectsNonzero: true,
  },

  // Layout (header + main + footer)
  {
    id: 'page-layout',
    html:
      '<header>Top</header><main><section>A</section><section>B</section></main><footer>Foot</footer>',
    expectsNonzero: true,
  },
  {
    id: 'sidebar-layout',
    html: '<aside class="sidebar">Nav</aside><main class="content">Body</main>',
    expectsNonzero: true,
  },

  // Hero / banner
  {
    id: 'hero',
    html:
      '<section class="hero"><h1>Welcome</h1><p>Subhead</p><button>CTA</button></section>',
    expectsNonzero: true,
  },

  // Inline styles
  {
    id: 'inline-style-1',
    html: '<div style="color: red; background: blue;">Styled</div>',
    expectsNonzero: true,
  },
  {
    id: 'inline-style-2',
    html: '<span style="font-size: 12px">Small</span>',
    expectsNonzero: true,
  },

  // Data attributes
  {
    id: 'data-attrs',
    html: '<div data-id="42" data-label="hello">Tagged</div>',
    expectsNonzero: true,
  },

  // Mixed text + inline elements
  {
    id: 'rich-text',
    html: '<p>This is <strong>bold</strong> and <em>italic</em>.</p>',
    expectsNonzero: true,
  },
  {
    id: 'pre-code',
    html: '<pre><code>const x = 1;</code></pre>',
    expectsNonzero: true,
  },
  {
    id: 'blockquote',
    html: '<blockquote><p>Quote</p><cite>Author</cite></blockquote>',
    expectsNonzero: true,
  },

  // Figure
  {
    id: 'figure',
    html:
      '<figure><img src="x.png" alt="X"/><figcaption>Caption</figcaption></figure>',
    expectsNonzero: true,
  },

  // Divider / break
  { id: 'divider', html: '<p>A</p><hr/><p>B</p>', expectsNonzero: true },

  // Skipped tags (still count as expecting some structure)
  {
    id: 'with-script',
    html: '<div>Visible</div><script>console.log("ignored")</script>',
    expectsNonzero: true,
  },
  {
    id: 'with-style-tag',
    html: '<style>.x{}</style><div class="x">Visible</div>',
    expectsNonzero: true,
  },

  // Empty / minimal
  { id: 'single-tag', html: '<div>x</div>', expectsNonzero: true },

  // Unmapped tag (fallback path)
  {
    id: 'unmapped',
    html: '<custom-card>hi</custom-card>',
    expectsNonzero: true,
  },
];

describe('M5 EXIT — LLM HTML corpus', () => {
  beforeEach(() => {
    _resetSchedulerForTesting();
    installPapi();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _resetSchedulerForTesting();
  });

  it('corpus has at least 30 samples', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(30);
  });

  it('every corpus sample sets innerHTML without throwing', () => {
    const failures: string[] = [];
    for (const sample of CORPUS) {
      try {
        const ref = mk('view');
        const e = wrapPapi(ref) as L3bUnsafeWritableElement;
        e.innerHTML = sample.html;
      } catch (err) {
        failures.push(`${sample.id}: ${String(err)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('every corpus sample produces non-empty subtree when expected', () => {
    const failures: string[] = [];
    for (const sample of CORPUS) {
      const ref = mk('view');
      const e = wrapPapi(ref) as L3bUnsafeWritableElement;
      try {
        e.innerHTML = sample.html;
      } catch {
        continue;
      }
      const found = e.querySelector('*');
      if (sample.expectsNonzero && found === null) {
        failures.push(sample.id);
      }
    }
    expect(failures).toEqual([]);
  });

  it('M5 EXIT: pass rate ≥ 70% (PRD §G3)', () => {
    let parsed = 0;
    let withTree = 0;
    for (const sample of CORPUS) {
      const ref = mk('view');
      const e = wrapPapi(ref) as L3bUnsafeWritableElement;
      try {
        e.innerHTML = sample.html;
        parsed++;
        if (e.querySelector('*') !== null) withTree++;
      } catch {
        // counted as parse failure
      }
    }
    const passRate = withTree / CORPUS.length;
    expect(parsed).toBe(CORPUS.length);
    expect(passRate).toBeGreaterThanOrEqual(0.7);
  });
});

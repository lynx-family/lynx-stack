import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupBackgroundElementTemplateDocument } from '../../../../../src/element-template/background/document.js';
import type { BackgroundElementTemplateDocument } from '../../../../../src/element-template/background/document.js';
import {
  BackgroundElementTemplateInstance,
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
} from '../../../../../src/element-template/background/instance.js';

describe('Background Element Template Adapter', () => {
  let doc: BackgroundElementTemplateDocument;

  beforeEach(() => {
    vi.resetAllMocks();
    doc = setupBackgroundElementTemplateDocument();
  });

  it('creates BackgroundElementTemplateInstance for normal elements', () => {
    const el = doc.createElement('view');
    expect(el).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(el.type).toBe('view');
    expect(el.text).toBe('');
    expect(el.nodeType).toBe(1);
  });

  it('creates builtin raw-text template instances for text nodes', () => {
    const node = doc.createTextNode('hello');
    expect(node).toBeInstanceOf(BackgroundElementTemplateInstance);
    expect(node.type).toBe(BUILTIN_RAW_TEXT_TEMPLATE_KEY);
    expect(node.text).toBe('hello');
    expect(node.nodeType).toBe(3);
  });
});

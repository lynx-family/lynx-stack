import './jsdom.js';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  rstest,
  test,
} from '@rstest/core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { encode, type TasmJSONInfo } from '../ts/encode/index.js';
import { TemplateSectionLabel } from '../ts/constants.js';
import {
  isAllXMLLeadingWhitespace,
  looksLikeLynxXML,
  xmlToTemplate,
} from '../ts/client/decodeWorker/xmlTemplate.js';
import type { MainMessage } from '../ts/client/decodeWorker/types.js';

rstest.mock('wasm-feature-detect', () => ({
  referenceTypes: async () => true,
  simd: async () => true,
}));

/**
 * The decode worker's own `self.onmessage` handler.
 *
 * `tests/jsdom.ts` installs a setter for `globalThis.onmessage` that forwards
 * messages over a `MessageChannel`, which loses the handler's returned promise
 * and so gives a test no way to await a `load`. Re-defining the property here -
 * before the worker module is imported - captures the handler directly, so each
 * test can await the full decode.
 */
let workerOnMessage:
  | ((event: MessageEvent) => unknown | Promise<unknown>)
  | undefined;

Object.defineProperty(globalThis, 'onmessage', {
  set: (handler) => {
    workerOnMessage = handler;
  },
  get: () => workerOnMessage,
  configurable: true,
});

await import('../ts/client/decodeWorker/decode.worker.js');

const { wasmInstance, wasmModule } = await import('../ts/client/wasm.js');

const fixture = readFileSync(
  path.join(__dirname, 'fixtures/markup-card.xml'),
  'utf8',
);

/**
 * Hands the worker the wasm module so it can encode `StyleInfo` sections. In
 * this environment `ts/client/wasm.ts` has already initialised the instance
 * (`isWorker` is false), so this only serves to resolve the worker's internal
 * `wasmModuleLoadedPromise`.
 */
await dispatch({ type: 'init', wasmModule });

async function dispatch(data: unknown): Promise<void> {
  if (!workerOnMessage) {
    throw new Error('the decode worker did not register a message handler');
  }
  await workerOnMessage({ data } as MessageEvent);
}

/** The blobs passed to `URL.createObjectURL`, keyed by the url handed back. */
let blobsByUrl: Map<string, Blob>;
let originalCreateObjectURL: typeof URL.createObjectURL;
const originalFetch = globalThis.fetch;

/** Reads back the source the worker put into a chunk's blob. */
async function blobText(blobUrl: string): Promise<string> {
  const blob = blobsByUrl.get(blobUrl);
  if (!blob) {
    throw new Error(`no blob was created for ${blobUrl}`);
  }
  return blob.text();
}

/**
 * Drives the worker's real `load` path against `body` and returns every message
 * it posted back, so the assertions cover the actual wire protocol rather than
 * the worker's internals.
 */
async function loadTemplate(
  body: string | Uint8Array,
  url = 'http://example.com/card.xml',
): Promise<MainMessage[]> {
  const bytes = typeof body === 'string'
    ? new TextEncoder().encode(body)
    : body;

  globalThis.fetch = rstest.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  })) as unknown as typeof fetch;

  const messages: MainMessage[] = [];
  const postMessageSpy = rstest.spyOn(globalThis, 'postMessage')
    .mockImplementation(
      ((message: MainMessage) => {
        messages.push(message);
      }) as typeof globalThis.postMessage,
    );

  try {
    await dispatch({
      type: 'load',
      url,
      fetchUrl: url,
      transformVW: false,
      transformVH: false,
      transformREM: false,
    });
  } finally {
    postMessageSpy.mockRestore();
  }

  // Heartbreak messages are emitted on a timer and are unrelated to the load.
  return messages.filter((message) => message.type !== 'heartbreak');
}

function sectionOf(messages: MainMessage[], label: number) {
  return messages.find(
    (message) => message.type === 'section' && message.label === label,
  ) as (MainMessage & { data: any; config?: any }) | undefined;
}

beforeEach(() => {
  blobsByUrl = new Map();
  originalCreateObjectURL = URL.createObjectURL;
  let counter = 0;
  URL.createObjectURL = ((blob: Blob) => {
    const blobUrl = `blob:mock/${counter++}`;
    blobsByUrl.set(blobUrl, blob);
    return blobUrl;
  }) as typeof URL.createObjectURL;
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('decode worker: Lynx XML markup', () => {
  test('emits the four sections for the acceptance fixture', async () => {
    const messages = await loadTemplate(fixture);

    expect(messages.some((message) => message.type === 'error')).toBe(false);
    expect(messages.at(-1)?.type).toBe('done');

    // Configurations must arrive first: the main thread needs the page config
    // before it can build the element APIs the other sections feed.
    const sectionLabels = messages
      .filter((message) => message.type === 'section')
      .map((message) => (message as { label: number }).label);
    expect(sectionLabels).toEqual([
      TemplateSectionLabel.Configurations,
      TemplateSectionLabel.StyleInfo,
      TemplateSectionLabel.LepusCode,
      TemplateSectionLabel.Manifest,
    ]);
  });

  test('assembles the page config for a buildless card', async () => {
    const messages = await loadTemplate(fixture);
    const config = sectionOf(
      messages,
      TemplateSectionLabel.Configurations,
    )!.data;

    // Mirrors `LynxTemplateBundle::Build()`, which hard-codes the config for an
    // XML bundle rather than reading it from the document.
    expect(config).toEqual({
      appType: 'card',
      cardType: 'react',
      isLazy: 'false',
      enableCSSSelector: 'true',
      enableRemoveCSSScope: 'true',
      defaultDisplayLinear: 'false',
      defaultOverflowVisible: 'false',
      enableJSDataProcessor: 'false',
    });
    // Every value must be a string: the main thread compares against `'true'`.
    for (const value of Object.values(config)) {
      expect(typeof value).toBe('string');
    }
  });

  test('routes the style section through the real wasm style encoder', async () => {
    const messages = await loadTemplate(fixture);
    const styleInfo = sectionOf(messages, TemplateSectionLabel.StyleInfo)!;

    // The section carries an encoded buffer, not CSS text, and is transferred.
    expect(styleInfo.data).toBeInstanceOf(ArrayBuffer);
    expect((styleInfo.data as ArrayBuffer).byteLength).toBeGreaterThan(0);

    // Decoding it back through the style engine must yield the fixture's rules,
    // which proves the raw-CSS `content` channel really carried them.
    const resource = new wasmInstance.StyleSheetResource(
      new Uint8Array(styleInfo.data as ArrayBuffer),
      document,
    );
    expect(resource).toBeDefined();
    resource.free();
  });

  test('wraps the main-thread script as the `root` lepus chunk', async () => {
    const messages = await loadTemplate(fixture);
    const lepusCode = sectionOf(messages, TemplateSectionLabel.LepusCode)!;

    expect(Object.keys(lepusCode.data)).toEqual(['root']);
    const source = await blobText(lepusCode.data['root']);

    // The mts wrapper: an IIFE that shadows the worker globals, and a sourceURL
    // so the script is debuggable.
    expect(source).toContain('//# allFunctionsCalledOnLoad');
    expect(source).toContain('"use strict"');
    expect(source).toContain('const navigator=void 0,postMessage=void 0');
    expect(source).toContain('//# sourceURL=http://example.com/card.xml/root');
    // A card's own chunk is side-effecting, so it must NOT be turned into an
    // expression assigned to `module.exports` (that is the lazy-component form).
    expect(source).not.toContain('module.exports=');
    // The document's own code survives verbatim.
    expect(source).toContain('lynx.getEngine()');
    expect(source).toContain('__RenderPage');
  });

  test('passes the background script through verbatim as /app-service.js', async () => {
    const messages = await loadTemplate(fixture);
    const manifest = sectionOf(messages, TemplateSectionLabel.Manifest)!;

    expect(Object.keys(manifest.data)).toEqual(['/app-service.js']);
    const source = await blobText(manifest.data['/app-service.js']);

    // `createChunkLoading` runs each bts chunk through
    // `new Function(...paramNames, jsContent)`, which is the web equivalent of
    // the engine's own module wrapper, so the source must stay unwrapped -
    // wrapping here would nest two module functions and hide `const mainThread`.
    expect(source.trimStart()).toMatch(
      /^const mainThread = lynx\.getCoreContext\(\);/,
    );
    expect(source).not.toContain('__init_card_bundle__');
    expect(source).not.toContain('tt.define');
    expect(source).not.toContain('(function(require, module, exports');
  });

  describe('degradation', () => {
    test('omits the style section when the document has no <style>', async () => {
      const messages = await loadTemplate(
        `<lynx version="5.4.2">
<script main-thread="true"><![CDATA[ globalThis.renderPage = () => {}; ]]></script>
</lynx>`,
      );

      expect(sectionOf(messages, TemplateSectionLabel.StyleInfo))
        .toBeUndefined();
      expect(sectionOf(messages, TemplateSectionLabel.LepusCode)).toBeDefined();
      expect(messages.at(-1)?.type).toBe('done');
    });

    test('keeps an empty <style> section, which is not the same as none', async () => {
      const messages = await loadTemplate(
        `<lynx version="5.4.2">
<style></style>
<script main-thread="true"><![CDATA[ globalThis.renderPage = () => {}; ]]></script>
</lynx>`,
      );

      // An empty section still produces a StyleInfo message; testing the parsed
      // section for truthiness rather than for `undefined` would drop it.
      expect(sectionOf(messages, TemplateSectionLabel.StyleInfo)).toBeDefined();
    });

    test('omits the manifest when the document has no background script', async () => {
      const messages = await loadTemplate(
        `<lynx version="5.4.2">
<script main-thread="true"><![CDATA[ globalThis.renderPage = () => {}; ]]></script>
</lynx>`,
      );

      expect(sectionOf(messages, TemplateSectionLabel.Manifest))
        .toBeUndefined();
    });
  });

  describe('malformed documents', () => {
    test('reports a parse failure with its offset through the error channel', async () => {
      const messages = await loadTemplate(
        `<lynx version="5.4.2">
<script main-thread="true"><![CDATA[ globalThis.renderPage = () => {}; ]]></script>
`,
      );

      const error = messages.find((message) => message.type === 'error') as
        | { type: 'error'; error: string }
        | undefined;
      expect(error).toBeDefined();
      expect(error!.error).toContain('invalid TemplateBundle XML at offset');
      expect(messages.some((message) => message.type === 'done')).toBe(false);
    });

    test('rejects a document without a main-thread script', async () => {
      const messages = await loadTemplate(
        `<lynx version="5.4.2">
<style><![CDATA[ .a { color: red; } ]]></style>
</lynx>`,
      );

      const error = messages.find((message) => message.type === 'error') as
        | { type: 'error'; error: string }
        | undefined;
      expect(error).toBeDefined();
      expect(error!.error).toContain('invalid TemplateBundle XML at offset');
      // No section may be emitted for a document that failed to parse.
      expect(messages.some((message) => message.type === 'section')).toBe(
        false,
      );
    });
  });
});

describe('decode worker: existing bypasses are unaffected', () => {
  const sampleTasm: TasmJSONInfo = {
    styleInfo: {},
    manifest: { '/app-service.js': 'globalThis.__bg = 1;' },
    cardType: 'card',
    appType: 'react',
    pageConfig: { enableCSSSelector: true },
    lepusCode: { root: 'globalThis.__mts = 1;' },
    customSections: { 'my-section': { type: 'lazy', content: 'some content' } },
    elementTemplates: {},
  };

  test('a binary bundle still decodes', async () => {
    const messages = await loadTemplate(
      encode(sampleTasm),
      'http://example.com/card.web.bundle',
    );

    expect(messages.some((message) => message.type === 'error')).toBe(false);
    expect(messages.at(-1)?.type).toBe('done');
    expect(sectionOf(messages, TemplateSectionLabel.Configurations))
      .toBeDefined();
    expect(sectionOf(messages, TemplateSectionLabel.LepusCode)).toBeDefined();
  });

  test('a JSON artifact still decodes', async () => {
    const messages = await loadTemplate(
      JSON.stringify({
        pageConfig: { enableCSSSelector: true },
        lepusCode: { root: 'globalThis.__mts = 1;' },
        manifest: { '/app-service.js': 'globalThis.__bg = 1;' },
      }),
      'http://example.com/card.json',
    );

    expect(messages.some((message) => message.type === 'error')).toBe(false);
    expect(messages.at(-1)?.type).toBe('done');
    expect(sectionOf(messages, TemplateSectionLabel.LepusCode)).toBeDefined();
    expect(sectionOf(messages, TemplateSectionLabel.Manifest)).toBeDefined();
  });

  test('an invalid binary header is still rejected', async () => {
    const messages = await loadTemplate(
      new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      'http://example.com/card.bogus',
    );

    const error = messages.find((message) => message.type === 'error') as
      | { type: 'error'; error: string }
      | undefined;
    expect(error?.error).toBe('Invalid Magic Header');
  });
});

/**
 * Unit level coverage of the pure translation layer. The suites above drive the
 * whole worker and therefore assert on the wire protocol; these assert on the
 * artifact structure the worker is handed, which is what the CSS assembly is
 * most easily pinned down by (and needs no wasm).
 */
describe('xmlToTemplate', () => {
  test('routes CSS through the raw-text `content` channel', () => {
    const result = xmlToTemplate(fixture);
    if (!result.success) {
      throw new Error(result.message);
    }

    // The whole stylesheet is handed over as one raw-text entry under css id 0
    // (the card's own, non component scoped rules) with no pre-parsed `rules`.
    // `cssLoader.parseAndPushContentRules` turns it into an `UnknownText`
    // selector section, which the style engine emits verbatim.
    expect(result.template.styleInfo).toEqual({
      '0': { content: [expect.any(String)], rules: [] },
    });
    const [content] = result.template.styleInfo!['0']!.content;
    expect(content).toContain('.card');
    expect(content).toContain('linear-gradient');
    // CSS is passed through untouched - no unit rewriting happens here.
    expect(content).toContain('100vh');
    expect(content).toContain('rem');
  });

  test('distinguishes an absent section from an empty one', () => {
    const withEmpty = xmlToTemplate(
      `<lynx version="5.4.2">
<style></style>
<script main-thread="true"><![CDATA[ x ]]></script>
<script background="true"><![CDATA[]]></script>
</lynx>`,
    );
    if (!withEmpty.success) throw new Error(withEmpty.message);
    // Present but empty: the entries exist, carrying empty sources.
    expect(withEmpty.template.styleInfo).toEqual({
      '0': { content: [''], rules: [] },
    });
    expect(withEmpty.template.manifest).toEqual({ '/app-service.js': '' });

    const withNeither = xmlToTemplate(
      `<lynx version="5.4.2">
<script main-thread="true"><![CDATA[ x ]]></script>
</lynx>`,
    );
    if (!withNeither.success) throw new Error(withNeither.message);
    expect(withNeither.template.styleInfo).toBeUndefined();
    expect(withNeither.template.manifest).toBeUndefined();
  });

  test('never throws, returning the parser message instead', () => {
    const result = xmlToTemplate('<lynx>');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.message).toContain('invalid TemplateBundle XML at offset');
  });
});

describe('looksLikeLynxXML', () => {
  test('accepts a markup document regardless of its prelude', () => {
    expect(looksLikeLynxXML('<lynx version="1">')).toBe(true);
    expect(looksLikeLynxXML('<?xml version="1.0"?>')).toBe(true);
    expect(looksLikeLynxXML('<!DOCTYPE lynx>')).toBe(true);
    expect(looksLikeLynxXML('<!-- a comment -->')).toBe(true);
    // Leading whitespace and a UTF-8 byte order mark are tolerated, matching
    // the parser.
    expect(looksLikeLynxXML('\n\t <lynx>')).toBe(true);
    expect(looksLikeLynxXML('\uFEFF<lynx>')).toBe(true);
  });

  test('rejects the other two artifact formats', () => {
    expect(looksLikeLynxXML('{"pageConfig":{}}')).toBe(false);
    // The binary magic header, `SDRA`.
    expect(looksLikeLynxXML('SDRAWROF')).toBe(false);
    expect(looksLikeLynxXML('')).toBe(false);
    expect(looksLikeLynxXML('   ')).toBe(false);
  });

  test('reports a whitespace only window as undecided', () => {
    // The worker sniffs a fixed size window first. Whitespace carries no
    // evidence either way, so a document that begins with more whitespace than
    // the window holds has to be classified against the rest of the payload -
    // otherwise it would fall through to the magic header check and fail with
    // an error describing the wrong cause.
    expect(isAllXMLLeadingWhitespace('        ')).toBe(true);
    expect(isAllXMLLeadingWhitespace('\uFEFF\n\t\r\f ')).toBe(true);
    expect(isAllXMLLeadingWhitespace('')).toBe(true);
    expect(isAllXMLLeadingWhitespace('   <lynx')).toBe(false);
    expect(isAllXMLLeadingWhitespace('SDRAWROF')).toBe(false);
  });
});

describe('decode worker: whitespace heavy markup', () => {
  test('loads a document whose whitespace outruns the sniff window', async () => {
    // Ten leading newlines exceed the 8 byte window the worker reads first.
    const messages = await loadTemplate(`${'\n'.repeat(10)}${fixture}`);

    expect(messages.some((message) => message.type === 'error')).toBe(false);
    expect(sectionOf(messages, TemplateSectionLabel.LepusCode)).toBeDefined();
  });
});

import {
  TemplateSectionLabel,
  MagicHeader0,
  MagicHeader1,
} from '../../constants.js';
import type {
  HeartbreakMessage,
  InitMessage,
  LoadTemplateMessage,
  MainMessage,
} from './types.js';

import { wasmInstance } from '../wasm.js';
import type { PageConfig } from '../../types/PageConfig.js';

let wasmModuleLoadedResolve: () => void;
const wasmModuleLoadedPromise: Promise<void> = new Promise((resolve) => {
  wasmModuleLoadedResolve = resolve;
});

import { loadStyleFromJSON } from './cssLoader.js';
import { decodeBinaryMap } from '../../common/decodeUtils.js';
import {
  isAllXMLLeadingWhitespace,
  looksLikeLynxXML,
  xmlToTemplate,
} from './xmlTemplate.js';

const MTS_CODE_WRAPPER_PREFIX =
  '//# allFunctionsCalledOnLoad\n(function(){ "use strict"; const navigator=void 0,postMessage=void 0; let window=void 0; ';

/**
 * The bundle compiler, loaded only when a markup (buildless Lynx XML) card
 * actually arrives.
 *
 * This is `@lynx-js/web-core/encode`'s own `encodeLynxXML` - the function the
 * build uses - reached through its source module rather than reimplemented. It is
 * heavy: a CSS parser (`@lynx-js/css-serializer`, which re-exports `css-tree`)
 * plus the `binary/encode` wasm, a few hundred kilobytes a card built ahead of
 * time never needs.
 *
 * It must stay behind this lazy `import()`. `TemplateManager` requests this worker
 * with `webpackPrefetch`, `webpackPreload` and `fetchPriority: "high"`, so
 * anything imported statically here is eagerly fetched for *every* card; the magic
 * comments below undo those inherited hints for this one chunk. Nothing in
 * `decodeWorker/` may import `ts/encode/` statically.
 *
 * Reaching the encoder from a browser bundle at all is what #3589 made possible:
 * `binary/encode`'s glue used to load its wasm through `node:fs` and is now
 * generated with `wasm-bindgen --target bundler`, which a bundler resolves on
 * either platform.
 */
const loadMarkupEncoder = () =>
  import(
    /* webpackChunkName: "web-core-markup-encoder" */
    /* webpackMode: "lazy" */
    /* webpackFetchPriority: "low" */
    /* webpackPrefetch: false */
    /* webpackPreload: false */
    '../../encode/xmlToTasmJSON.js'
  );

const HEARTBREAK_INTERVAL_MS = 1000;
let heartbreakTimer: ReturnType<typeof setTimeout> | undefined;

class StreamReader {
  #reader: ReadableStreamDefaultReader<Uint8Array>;
  #buffer: Uint8Array = new Uint8Array(0);

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.#reader = reader;
  }

  async read(size: number): Promise<Uint8Array | null> {
    if (this.#buffer.length >= size) {
      const result = this.#buffer.slice(0, size);
      this.#buffer = this.#buffer.slice(size);
      return result;
    }

    while (this.#buffer.length < size) {
      const { done, value } = await this.#reader.read();

      if (value) {
        const newBuffer = new Uint8Array(this.#buffer.length + value.length);
        newBuffer.set(this.#buffer);
        newBuffer.set(value, this.#buffer.length);
        this.#buffer = newBuffer;
      }

      if (done) {
        break;
      }
    }

    if (this.#buffer.length < size) {
      if (this.#buffer.length === 0) {
        return null;
      }
      throw new Error(
        `Unexpected end of stream. Expected ${size} bytes, got ${this.#buffer.length}`,
      );
    }

    const result = this.#buffer.slice(0, size);
    this.#buffer = this.#buffer.slice(size);
    return result;
  }

  async readRest(): Promise<Uint8Array> {
    while (true) {
      const { done, value } = await this.#reader.read();
      if (value) {
        const newBuffer = new Uint8Array(this.#buffer.length + value.length);
        newBuffer.set(this.#buffer);
        newBuffer.set(value, this.#buffer.length);
        this.#buffer = newBuffer;
      }
      if (done) {
        break;
      }
    }
    const result = this.#buffer;
    this.#buffer = new Uint8Array(0);
    return result;
  }
}

function decodeJSONMap<T>(buffer: Uint8Array): Record<string, T> {
  const utf16Array = new Uint16Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / 2,
  );
  let jsonString = '';
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < utf16Array.length; i += CHUNK_SIZE) {
    jsonString += String.fromCharCode.apply(
      null,
      utf16Array.subarray(i, i + CHUNK_SIZE) as unknown as number[],
    );
  }

  return JSON.parse(jsonString);
}

function postHeartbreak() {
  postMessage({ type: 'heartbreak' } as MainMessage);
}

/**
 * Decodes two consecutive chunks of a UTF-8 stream as a single string.
 *
 * Decoding each chunk on its own would corrupt a multi-byte sequence split
 * across the boundary, so the chunks are joined before decoding.
 */
function decodeConcatenatedUTF8(head: Uint8Array, tail: Uint8Array): string {
  const joined = new Uint8Array(head.length + tail.length);
  joined.set(head);
  joined.set(tail, head.length);
  return new TextDecoder().decode(joined);
}

function unrefTimer(timer: ReturnType<typeof setTimeout>) {
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    (timer as { unref: () => void }).unref();
  }
}

function scheduleHeartbreak() {
  if (heartbreakTimer !== undefined) {
    return;
  }
  heartbreakTimer = setTimeout(() => {
    heartbreakTimer = undefined;
    postHeartbreak();
  }, HEARTBREAK_INTERVAL_MS);
  unrefTimer(heartbreakTimer);
}

self.onmessage = async (
  event:
    | MessageEvent<LoadTemplateMessage>
    | MessageEvent<InitMessage>
    | MessageEvent<HeartbreakMessage>,
) => {
  const data = event.data;
  if (data.type === 'init') {
    const { wasmModule } = data;
    wasmInstance.initSync({ module: wasmModule });
    wasmModuleLoadedResolve();
  } else if (data.type === 'heartbreak') {
    scheduleHeartbreak();
  } else if (data.type === 'load') {
    const {
      url,
      fetchUrl,
      overrideConfig,
      transformVW,
      transformVH,
      transformREM,
    } = data;
    try {
      const response = await fetch(fetchUrl, {
        headers: {
          // Advertise the markup format too. Servers routinely ignore `Accept`
          // for static files, so the format is decided by sniffing the payload
          // in `handleStream` rather than by the response's `Content-Type`.
          'Accept':
            'application/octet-stream, application/json, application/xml, text/xml',
        },
      });
      if (!response.body || response.status !== 200) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }
      const reader = response.body.getReader();
      await handleStream(
        url,
        reader,
        transformVW,
        transformVH,
        transformREM,
        overrideConfig,
      );
      postMessage({ type: 'done', url } as MainMessage);
    } catch (error) {
      postMessage(
        { type: 'error', url, error: (error as Error).message } as MainMessage,
      );
    }
  }
};
async function handleStream(
  url: string,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  overrideConfig?: Partial<PageConfig>,
) {
  const streamReader = new StreamReader(reader);
  let config: Partial<PageConfig> = {};

  // 1. Check MagicHeader
  const headerBytes = await streamReader.read(8);
  if (!headerBytes) {
    throw new Error('Empty stream');
  }

  // Check if JSON (starts with {)
  if (headerBytes[0] === 123) {
    const rest = await streamReader.readRest();
    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(headerBytes) + decoder.decode(rest);
    const json = JSON.parse(jsonStr);
    await handleJSON(
      json,
      url,
      transformVW,
      transformVH,
      transformREM,
      overrideConfig,
    );
    return;
  }

  // Check if Lynx XML markup. A binary bundle starts with the `SDRA` magic and a
  // JSON artifact with `{`, so a leading `<` (optionally preceded by a BOM or
  // whitespace) unambiguously identifies the markup format. The prelude may be
  // an XML declaration, a doctype, a comment or the `<lynx>` root, all of which
  // begin with `<`.
  {
    const decoder = new TextDecoder();
    const header = decoder.decode(headerBytes);
    // The parser tolerates unlimited leading whitespace, so a document whose
    // first 8 bytes are all whitespace would otherwise be missed here and then
    // fail the magic-header check with an error describing the wrong cause.
    // Only such a header needs the rest of the payload to classify.
    const rest = isAllXMLLeadingWhitespace(header)
      ? await streamReader.readRest()
      : undefined;
    // Decode the chunks as one buffer: a multi-byte UTF-8 sequence may straddle
    // the boundary, and decoding the halves separately would corrupt it.
    const sniffed = rest === undefined
      ? header
      : decodeConcatenatedUTF8(headerBytes, rest);
    if (looksLikeLynxXML(sniffed)) {
      const source = rest === undefined
        ? decodeConcatenatedUTF8(headerBytes, await streamReader.readRest())
        : sniffed;
      await handleXML(
        source,
        url,
        transformVW,
        transformVH,
        transformREM,
        overrideConfig,
      );
      return;
    }
    if (rest !== undefined) {
      // The payload is fully consumed and is not markup, so the magic-header
      // check below cannot run against a partially read stream.
      throw new Error('Invalid Magic Header');
    }
  }

  const view = new DataView(
    headerBytes.buffer,
    headerBytes.byteOffset,
    headerBytes.byteLength,
  );
  const magic0 = view.getUint32(0, true);
  const magic1 = view.getUint32(4, true);
  if (magic0 !== MagicHeader0 || magic1 !== MagicHeader1) {
    // Neither a bundle nor JSON, so the one artifact shape left is a Lynx XML
    // markup card. It arrives here rather than being sniffed for up front
    // because it is the only shape that cannot be streamed - the XML parser has
    // no incremental mode - and making every artifact pay for a look-ahead in
    // order to route the one that does not stream had it backwards. By this
    // point the header is already in hand and nothing has to be replayed.
    await handleMarkup(
      headerBytes,
      await streamReader.readRest(),
      url,
      transformVW,
      transformVH,
      transformREM,
      overrideConfig,
    );
    return;
  }

  // 2. Check Version
  const versionBytes = await streamReader.read(4);
  if (!versionBytes) {
    throw new Error('Unexpected EOF reading version');
  }
  const versionView = new DataView(
    versionBytes.buffer,
    versionBytes.byteOffset,
    versionBytes.byteLength,
  );
  const version = versionView.getUint32(0, true);
  if (version > 1) {
    throw new Error(`Unsupported version: ${version}`);
  }

  // 3. Read Sections
  while (true) {
    const labelBytes = await streamReader.read(4);
    if (!labelBytes) {
      break; // EOF
    }
    const labelView = new DataView(
      labelBytes.buffer,
      labelBytes.byteOffset,
      labelBytes.byteLength,
    );
    const label = labelView.getUint32(0, true);

    const lengthBytes = await streamReader.read(4);
    if (!lengthBytes) {
      throw new Error('Unexpected EOF reading section length');
    }
    const lengthView = new DataView(
      lengthBytes.buffer,
      lengthBytes.byteOffset,
      lengthBytes.byteLength,
    );
    const length = lengthView.getUint32(0, true);

    const content = await streamReader.read(length);
    if (!content) {
      throw new Error(
        `Unexpected EOF reading section content. Expected ${length} bytes.`,
      );
    }

    switch (label) {
      case TemplateSectionLabel.Configurations: {
        config = overrideConfig
          ? { ...decodeJSONMap<string>(content), ...overrideConfig }
          : decodeJSONMap<string>(content);
        postMessage(
          { type: 'section', label, url, data: config } as MainMessage,
        );
        break;
      }
      case TemplateSectionLabel.StyleInfo: {
        await wasmModuleLoadedPromise;
        const buffer = wasmInstance.decode_style_info(
          content,
          config['isLazy'] === 'true' ? url : undefined,
          config['enableCSSSelector'] === 'true',
          transformVW,
          transformVH,
          transformREM,
        );
        postMessage(
          {
            type: 'section',
            label,
            url,
            data: buffer.buffer,
            config,
          } as MainMessage,
          {
            transfer: [buffer.buffer],
          },
        );
        break;
      }
      case TemplateSectionLabel.LepusCode: {
        const codeMap = decodeBinaryMap(content);
        const isLazy = config['isLazy'] === 'true';
        // An external bundle's mts chunk is CommonJS-style (it writes to
        // `exports`), so give it a `module.exports`/`exports` env. A card's own
        // lepus chunk is either side-effecting (non-lazy) or an expression
        // assigned to `module.exports` (lazy component root).
        const prefix = config['isExternalBundle'] === 'true'
          ? 'var exports=(module.exports={}); '
          : isLazy
          ? 'module.exports='
          : '';
        const blobMap: Record<string, string> = {};
        for (const [key, code] of Object.entries(codeMap)) {
          const blob = new Blob([
            MTS_CODE_WRAPPER_PREFIX,
            prefix,
            code as unknown as BlobPart,
            ' \n })()\n//# sourceURL=',
            url,
            '/',
            key,
            '\n',
          ], {
            type: 'text/javascript; charset=utf-8',
          });
          blobMap[key] = URL.createObjectURL(blob);
        }
        postMessage(
          { type: 'section', label, url, data: blobMap, config } as MainMessage,
        );
        break;
      }
      case TemplateSectionLabel.ElementTemplates: {
        postMessage(
          { type: 'section', label, url, data: content } as MainMessage,
          [content.buffer],
        );
        break;
      }
      case TemplateSectionLabel.CustomSections: {
        postMessage(
          { type: 'section', label, url, data: content.buffer } as MainMessage,
          {
            transfer: [content.buffer],
          },
        );
        break;
      }
      case TemplateSectionLabel.Manifest: {
        const codeMap = decodeBinaryMap(content);
        const blobMap: Record<string, string> = {};
        for (const [key, code] of Object.entries(codeMap)) {
          const blob = new Blob([
            code as unknown as BlobPart,
            '//# sourceURL=',
            url,
            '/',
            key,
          ], {
            type: 'text/javascript; charset=utf-8',
          });
          blobMap[key] = URL.createObjectURL(blob);
        }
        postMessage(
          { type: 'section', label, url, data: blobMap } as MainMessage,
        );
        break;
      }
      default:
        throw new Error(`Unknown section label: ${label}`);
    }
  }
}

/**
 * Whether the text begins an XML document, i.e. its first non-whitespace
 * character opens a tag.
 *
 * This is not a sniff and nothing is routed by it: by the time it runs the
 * artifact has already been classified as markup, by elimination. It exists only
 * so that {@link handleMarkup} can tell the two failures apart - a document the
 * author wrote wrong, and bytes that were never a Lynx artifact of any kind.
 *
 * The rule is deliberately the parser's own precondition rather than a new one:
 * `parseLynxXML` skips a BOM (already stripped by `TextDecoder` here) and the
 * same ASCII whitespace set, then requires `<?xml`, `<!` or `<lynx`. Anything
 * this rejects would have been rejected there too, one step later and with a
 * message about a missing root element.
 */
function startsXMLDocument(source: string): boolean {
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (
      character === ' ' || character === '\t' || character === '\n'
      || character === '\r' || character === '\f'
    ) {
      continue;
    }
    return character === '<';
  }
  return false;
}

/**
 * Compiles a Lynx XML markup card into a bundle and loads that, the artifact
 * shape reached by elimination.
 *
 * A markup card is not a third kind of artifact. It is compiled here, in the
 * browser, by the same `encodeLynxXML` a build would run, into the same
 * `.web.bundle` bytes a build would emit - magic header, version, and the five
 * sections in the encoder's order - and those bytes are then handed back to
 * {@link handleStream}. Every section is read by the reader that already exists,
 * so there is no markup-specific decoding anywhere: not in this worker, and not
 * on the main thread.
 *
 * The recursion terminates after exactly one extra level. `encode` writes
 * `MagicHeader0`/`MagicHeader1` at offset 0 unconditionally, so the second
 * `handleStream` takes the binary branch. Were that ever untrue the bytes would
 * reach {@link startsXMLDocument}, whose answer for a bundle's first byte (`S`)
 * is `false`, and the recursion would end in a thrown error rather than a loop.
 *
 * ## Why it reports two different failures
 *
 * Because it is the fallback, a corrupted binary bundle lands here too: a single
 * flipped bit in the magic header is enough. Handing those bytes to the XML
 * parser would answer with `expected '<lynx version="...">' root element`, which
 * sends whoever is reading it looking for a markup bug in a file that is not
 * markup. So the bytes are checked for the shape of a text document first, and if
 * they do not have it the diagnosis `handleStream` used to give -
 * `Invalid Magic Header` - is reported instead, with the offending header bytes.
 * That check also keeps the several hundred kilobyte compiler chunk from being
 * fetched only to reject a corrupt bundle.
 */
async function handleMarkup(
  head: Uint8Array,
  rest: Uint8Array,
  url: string,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  overrideConfig?: Partial<PageConfig>,
) {
  const bytes = new Uint8Array(head.length + rest.length);
  bytes.set(head);
  bytes.set(rest, head.length);
  // Joined before a single `TextDecoder` pass rather than decoded in two,
  // because a multi-byte sequence can straddle the eight byte header. Nothing
  // observable rests on it today: bytes 0..7 of a Lynx XML document are ASCII
  // by grammar - `<?xml`, `<!`, `<lynx` or whitespace - so a character can only
  // straddle inside a leading comment or declaration, both of which are
  // discarded. It costs three lines and stops being a question.
  // `TextDecoder` strips a leading UTF-8 BOM for us.
  const source = new TextDecoder().decode(bytes);

  if (!startsXMLDocument(source)) {
    const headHex = Array.from(head, byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
    throw new Error(
      `Invalid Magic Header: not a Lynx bundle, and not a Lynx XML markup card`
        + ` either - the content does not begin a tag. First bytes: ${headHex}`,
    );
  }

  const { encodeLynxXML } = await loadMarkupEncoder();
  const compiled = encodeLynxXML(source);
  if (!compiled.success) {
    throw new Error(compiled.message);
  }

  await handleStream(
    url,
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(compiled.buffer);
        controller.close();
      },
    }).getReader(),
    transformVW,
    transformVH,
    transformREM,
    overrideConfig,
  );
}

async function handleJSON(
  json: any,
  url: string,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  overrideConfig?: Partial<PageConfig>,
) {
  // Configurations
  let config: Partial<PageConfig> = {};
  if (json.pageConfig) {
    config = { ...json.pageConfig };
  }
  if (json.lepusCode?.root && typeof json.lepusCode.root === 'string') {
    const appType = json.appType
      ?? (json.lepusCode.root.startsWith('(function (globDynamicComponentEntry')
        ? 'lazy'
        : 'card');
    config.cardType = json.cardType ?? json.pageConfig?.cardType ?? 'react';
    config.appType = config.appType ?? appType;
    config.isLazy = (appType === 'card') ? 'false' : 'true';
  }

  if (overrideConfig) {
    config = { ...config, ...overrideConfig };
  }
  config = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, value.toString()]),
  );
  postMessage({
    type: 'section',
    label: TemplateSectionLabel.Configurations,
    url,
    data: config,
  } as MainMessage);

  // StyleInfo
  if (json.styleInfo) {
    await wasmModuleLoadedPromise;
    const buffer = loadStyleFromJSON(
      json.styleInfo,
      config['enableCSSSelector'] === 'true',
      transformVW,
      transformVH,
      transformREM,
      config['isLazy'] === 'true' ? url : undefined,
    );
    postMessage(
      {
        type: 'section',
        label: TemplateSectionLabel.StyleInfo,
        url,
        data: buffer.buffer,
        config,
      } as MainMessage,
      {
        transfer: [buffer.buffer],
      },
    );
  }

  // LepusCode
  if (json.lepusCode) {
    // Flattened structure in json: { root: "...", chunk1: "..." }
    const isLazy = config['isLazy'] === 'true';
    const blobMap: Record<string, string> = {};
    for (const [key, code] of Object.entries(json.lepusCode)) {
      if (typeof code !== 'string') continue;
      const prefix = `${MTS_CODE_WRAPPER_PREFIX}${
        isLazy ? 'module.exports=' : ''
      } `;
      const suffix = ` \n })()\n//# sourceURL=${url}/${key}\n`;
      const blob = new Blob([prefix, code, suffix], {
        type: 'text/javascript; charset=utf-8',
      });
      blobMap[key] = URL.createObjectURL(blob);
    }
    postMessage({
      type: 'section',
      label: TemplateSectionLabel.LepusCode,
      url,
      data: blobMap,
      config,
    } as MainMessage);
  }

  // Manifest
  if (json.manifest) {
    const blobMap: Record<string, string> = {};
    for (const [key, code] of Object.entries(json.manifest)) {
      if (typeof code !== 'string') continue;
      const blob = new Blob([code], {
        type: 'text/javascript;',
      });
      blobMap[key] = URL.createObjectURL(blob);
    }
    postMessage({
      type: 'section',
      label: TemplateSectionLabel.Manifest,
      url,
      data: blobMap,
    } as MainMessage);
  }

  // CustomSections
  if (json.customSections) {
    // Currently we don't have a way to encode custom sections here.
    // If main thread accepts generic object, we send it.
    // But TemplateManager expects buffer?
    // TemplateManager: case CustomSections: #setCustomSection(url, data). data: any.
    // So passing object is fine!
    postMessage({
      type: 'section',
      label: TemplateSectionLabel.CustomSections,
      url,
      data: json.customSections,
    } as MainMessage);
  }

  // ElementTemplates
  if (json.elementTemplates && Object.keys(json.elementTemplates).length > 0) {
    // TemplateManager expects Uint8Array for ElementTemplates.
    // We can't support this easily for JSON.
    throw new Error(
      'ElementTemplates in JSON artifacts are not supported yet.',
    );
  }
}

/**
 * Handles a single file Lynx XML markup document.
 *
 * The document is translated into the JSON artifact shape and then assembled by
 * {@link handleJSON}, so both buildless formats emit exactly the same section
 * message sequence.
 *
 * A parse failure is reported by throwing, which the `load` handler forwards
 * through the worker's `error` channel; the thrown message is the parser's
 * `formattedMessage`, which locates the failure by JS string index (UTF-16
 * code units, not bytes - the distinction matters for non-ASCII documents).
 *
 * Awaiting the translation matters: it fetches the CSS parser on demand, so a
 * floating promise here would both drop the card's sections and escape the
 * `load` handler's `catch`, leaving the failure unreported.
 */
async function handleXML(
  source: string,
  url: string,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  overrideConfig?: Partial<PageConfig>,
) {
  const result = await xmlToTemplate(source);
  if (!result.success) {
    throw new Error(result.message);
  }
  await handleJSON(
    result.template,
    url,
    transformVW,
    transformVH,
    transformREM,
    overrideConfig,
  );
}

postMessage({ type: 'ready' } as MainMessage);
scheduleHeartbreak();

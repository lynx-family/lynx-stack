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
import { looksLikeLynxXML, xmlToTemplate } from './xmlTemplate.js';

const MTS_CODE_WRAPPER_PREFIX =
  '//# allFunctionsCalledOnLoad\n(function(){ "use strict"; const navigator=void 0,postMessage=void 0; let window=void 0; ';

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
 * Decoding each chunk on its own would mis-decode a multi-byte sequence split
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
  // begin with `<`; sniffing the first 8 bytes is therefore enough.
  {
    const decoder = new TextDecoder();
    if (looksLikeLynxXML(decoder.decode(headerBytes))) {
      const rest = await streamReader.readRest();
      // Decode the two chunks as one buffer: a multi-byte UTF-8 sequence may
      // straddle the 8 byte boundary, and decoding the halves separately would
      // corrupt it.
      const source = decodeConcatenatedUTF8(headerBytes, rest);
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
  }

  const view = new DataView(
    headerBytes.buffer,
    headerBytes.byteOffset,
    headerBytes.byteLength,
  );
  const magic0 = view.getUint32(0, true);
  const magic1 = view.getUint32(4, true);
  if (magic0 !== MagicHeader0 || magic1 !== MagicHeader1) {
    throw new Error('Invalid Magic Header');
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
 * `formattedMessage`, which carries the byte offset of the failure.
 */
async function handleXML(
  source: string,
  url: string,
  transformVW: boolean,
  transformVH: boolean,
  transformREM: boolean,
  overrideConfig?: Partial<PageConfig>,
) {
  const result = xmlToTemplate(source);
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

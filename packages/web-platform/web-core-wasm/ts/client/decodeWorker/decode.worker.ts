import { TemplateSectionLabel, MagicHeader } from '../../constants.js';
import type { InitMessage, LoadTemplateMessage, MainMessage } from './types.js';

import { wasmInstance } from '../wasm.js';
import type { PageConfig } from '../../types/PageConfig.js';

let wasmModuleLoadedResolve: () => void;
const wasmModuleLoadedPromise: Promise<void> = new Promise((resolve) => {
  wasmModuleLoadedResolve = resolve;
});

import { loadStyleFromJSON } from './cssLoader.js';

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

function decodeBinaryMap(buffer: Uint8Array): Record<string, Uint8Array> {
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  let offset = 0;
  if (buffer.byteLength < 4) {
    throw new Error('Buffer too short for count');
  }
  const count = view.getUint32(offset, true);
  offset += 4;

  const result: Record<string, Uint8Array> = {};
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i++) {
    if (buffer.byteLength < offset + 4) {
      throw new Error('Buffer too short for key length');
    }
    const keyLen = view.getUint32(offset, true);
    offset += 4;

    if (buffer.byteLength < offset + keyLen) {
      throw new Error('Buffer too short for key');
    }
    const key = decoder.decode(buffer.subarray(offset, offset + keyLen));
    offset += keyLen;

    if (buffer.byteLength < offset + 4) {
      throw new Error('Buffer too short for value length');
    }
    const valLen = view.getUint32(offset, true);
    offset += 4;

    if (buffer.byteLength < offset + valLen) {
      throw new Error('Buffer too short for value');
    }
    const val = buffer.subarray(offset, offset + valLen);
    offset += valLen;

    result[key] = val;
  }
  return result;
}

self.onmessage = async (
  event: MessageEvent<LoadTemplateMessage> | MessageEvent<InitMessage>,
) => {
  const data = event.data;
  if (data.type === 'init') {
    const { wasmModule } = data;
    wasmInstance.initSync({ module: wasmModule });
    wasmModuleLoadedResolve();
  } else if (data.type === 'load') {
    const { url, fetchUrl, overrideConfig } = data;
    try {
      const response = await fetch(fetchUrl, {
        headers: {
          'Content-Type': 'octet-stream',
        },
      });
      if (!response.body || response.status !== 200) {
        throw new Error(`Failed to fetch template: ${response.statusText}`);
      }
      const reader = response.body.getReader();
      await handleStream(url, reader, overrideConfig);
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
    await handleJSON(json, url, overrideConfig);
    return;
  }

  const view = new DataView(
    headerBytes.buffer,
    headerBytes.byteOffset,
    headerBytes.byteLength,
  );
  const magic = view.getBigUint64(0, true); // Little Endian
  if (magic !== BigInt(MagicHeader)) {
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
        const blobMap: Record<string, string> = {};
        for (const [key, code] of Object.entries(codeMap)) {
          const blob = new Blob([
            '//# allFunctionsCalledOnLoad\n(function(){ "use strict"; const navigator=void 0,postMessage=void 0,window=void 0; ',
            isLazy ? 'module.exports=' : '',
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
  overrideConfig?: Partial<PageConfig>,
) {
  // Configurations
  let config: Partial<PageConfig> = {};
  if (json.pageConfig) {
    config = { ...json.pageConfig };
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
      const prefix =
        `(function(){ "use strict"; const navigator=void 0,postMessage=void 0,window=void 0; ${
          isLazy ? 'module.exports=' : ''
        } `;
      const suffix = ` \n })()\n//# sourceURL=${url}/${key}\n`;
      const blob = new Blob([prefix, code, suffix], {
        type: 'text/javascript;',
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

postMessage({ type: 'ready' } as MainMessage);

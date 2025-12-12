import { TemplateSectionLabel, MagicHeader } from '../../constants.js';
import type { LoadTemplateMessage, MainMessage } from './types.js';

class StreamReader {
  private reader:
    | ReadableStreamDefaultReader<Uint8Array>
    | ReadableStreamBYOBReader;
  private buffer: Uint8Array = new Uint8Array(0);
  private isBYOBReader: boolean;

  constructor(
    reader: ReadableStreamDefaultReader<Uint8Array> | ReadableStreamBYOBReader,
    isBYOBReader: boolean,
  ) {
    this.reader = reader;
    this.isBYOBReader = isBYOBReader;
  }

  async read(size: number): Promise<Uint8Array | null> {
    if (this.buffer.length >= size) {
      const result = this.buffer.slice(0, size);
      this.buffer = this.buffer.slice(size);
      return result;
    }

    if (this.isBYOBReader) {
      const newBuffer = new Uint8Array(size);
      newBuffer.set(this.buffer);
      let offset = this.buffer.length;
      let buffer = newBuffer.buffer;

      while (offset < size) {
        const view = new Uint8Array(buffer, offset, size - offset);
        const { done, value } = await (
          this.reader as ReadableStreamBYOBReader
        ).read(view);

        if (done) {
          if (offset === 0) {
            return null;
          }
          throw new Error(
            `Unexpected end of stream. Expected ${size} bytes, got ${offset}`,
          );
        }

        buffer = value.buffer;
        offset += value.byteLength;
      }

      this.buffer = new Uint8Array(0);
      return new Uint8Array(buffer);
    }

    while (this.buffer.length < size) {
      const { done, value } = await (
        this.reader as ReadableStreamDefaultReader<Uint8Array>
      ).read();

      if (value) {
        const newBuffer = new Uint8Array(this.buffer.length + value.length);
        newBuffer.set(this.buffer);
        newBuffer.set(value, this.buffer.length);
        this.buffer = newBuffer;
      }

      if (done) {
        break;
      }
    }

    if (this.buffer.length < size) {
      if (this.buffer.length === 0) {
        return null;
      }
      throw new Error(
        `Unexpected end of stream. Expected ${size} bytes, got ${this.buffer.length}`,
      );
    }

    const result = this.buffer.slice(0, size);
    this.buffer = this.buffer.slice(size);
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

self.onmessage = async (event: MessageEvent<LoadTemplateMessage>) => {
  const { type, url, fetchUrl } = event.data;
  if (type === 'load') {
    try {
      const response = await fetch(fetchUrl || url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch template: ${response.status} ${response.statusText}`,
        );
      }
      if (!response.body) {
        throw new Error('No response body');
      }

      let reader:
        | ReadableStreamDefaultReader<Uint8Array>
        | ReadableStreamBYOBReader;
      let isBYOB = false;

      try {
        reader = response.body.getReader({ mode: 'byob' });
        isBYOB = true;
      } catch {
        reader = response.body.getReader();
        isBYOB = false;
      }

      await handleStream(url, reader, isBYOB);
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
  reader: ReadableStreamDefaultReader<Uint8Array> | ReadableStreamBYOBReader,
  isBYOB: boolean,
) {
  const streamReader = new StreamReader(reader, isBYOB);
  let config: Record<string, string> = {};

  // 1. Check MagicHeader
  const headerBytes = await streamReader.read(8);
  if (!headerBytes) {
    throw new Error('Empty stream');
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
        config = decodeJSONMap<string>(content);
        postMessage(
          { type: 'section', label, url, data: config } as MainMessage,
        );
        break;
      }
      case TemplateSectionLabel.StyleInfo: {
        // Transfer content buffer
        postMessage(
          { type: 'section', label, url, data: content, config } as MainMessage,
          [content.buffer],
        );
        break;
      }
      case TemplateSectionLabel.LepusCode: {
        const codeMap = decodeBinaryMap(content);
        const isLazy = config['isLazy'] === 'true';
        const blobMap: Record<string, string> = {};
        for (const [key, code] of Object.entries(codeMap)) {
          const prefix =
            `//# allFunctionsCalledOnLoad\n(function(){ "use strict"; const navigator=void 0,postMessage=void 0,window=void 0; ${
              isLazy ? 'module.exports=' : ''
            } `;
          const suffix = ` \n })()\n//# sourceURL=${url}\n`;
          const blob = new Blob([prefix, code as unknown as BlobPart, suffix], {
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
        const custom = decodeJSONMap<unknown>(content);
        postMessage(
          { type: 'section', label, url, data: custom } as MainMessage,
        );
        break;
      }
      case TemplateSectionLabel.Manifest: {
        const codeMap = decodeBinaryMap(content);
        const blobMap: Record<string, string> = {};
        for (const [key, code] of Object.entries(codeMap)) {
          const suffix = `//# sourceURL=${url}/${key}`;
          const blob = new Blob([code as unknown as BlobPart, suffix], {
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

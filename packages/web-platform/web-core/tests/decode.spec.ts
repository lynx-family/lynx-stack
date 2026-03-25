import { describe, it, expect, vi } from 'vitest';
import { decodeTemplate } from '../ts/server/decode.js';
import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../ts/constants.js';
import * as wasm from '../ts/server/wasm.js';

vi.mock('../ts/server/wasm.js', () => ({
  decode_style_info: vi.fn((buffer: Uint8Array) => buffer),
}));

function encodeString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function encodeBinaryMap(map: Record<string, string>): Uint8Array {
  const keys = Object.keys(map);
  const parts: Uint8Array[] = [];

  // Count (4 bytes)
  const countBuf = new Uint8Array(4);
  new DataView(countBuf.buffer).setUint32(0, keys.length, true);
  parts.push(countBuf);

  for (const key of keys) {
    const val = map[key];
    const keyBytes = encodeString(key);
    const valBytes = encodeString(val);

    // Key Len
    const keyLenBuf = new Uint8Array(4);
    new DataView(keyLenBuf.buffer).setUint32(0, keyBytes.length, true);
    parts.push(keyLenBuf);
    parts.push(keyBytes);

    // Val Len
    const valLenBuf = new Uint8Array(4);
    new DataView(valLenBuf.buffer).setUint32(0, valBytes.length, true);
    parts.push(valLenBuf);
    parts.push(valBytes);
  }

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

function createTemplate(callbacks: {
  version?: number;
  sections?: Array<{ label: number; content: Uint8Array }>;
} = {}): Uint8Array {
  const parts: Uint8Array[] = [];

  // Magic Header
  const magicBuf = new Uint8Array(8);
  const view = new DataView(magicBuf.buffer);
  view.setUint32(0, MagicHeader0, true);
  view.setUint32(4, MagicHeader1, true);
  parts.push(magicBuf);

  // Version
  const versionBuf = new Uint8Array(4);
  new DataView(versionBuf.buffer).setUint32(
    0,
    callbacks.version !== undefined ? callbacks.version : 1,
    true,
  );
  parts.push(versionBuf);

  // Sections
  if (callbacks.sections) {
    for (const sec of callbacks.sections) {
      // Label
      const labelBuf = new Uint8Array(4);
      new DataView(labelBuf.buffer).setUint32(0, sec.label, true);
      parts.push(labelBuf);

      // Length
      const lenBuf = new Uint8Array(4);
      new DataView(lenBuf.buffer).setUint32(0, sec.content.length, true);
      parts.push(lenBuf);

      // Content
      parts.push(sec.content);
    }
  }

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

describe('decodeTemplate', () => {
  it('should throw if buffer is too short', () => {
    expect(() => decodeTemplate(new Uint8Array(4))).toThrow(
      'Buffer too short for Magic Header',
    );
  });

  it('should throw if magic header is invalid', () => {
    const buffer = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(() => decodeTemplate(buffer)).toThrow('Invalid Magic Header');
  });

  it('should throw if version is unsupported', () => {
    const buffer = createTemplate({ version: 2 });
    expect(() => decodeTemplate(buffer)).toThrow('Unsupported version: 2');
  });

  it('should decode empty template correctly', () => {
    const buffer = createTemplate({ sections: [] });
    const result = decodeTemplate(buffer);
    expect(result).toEqual({
      config: {},
      styleInfo: undefined,
      lepusCode: {},
      customSections: undefined,
    });
  });

  it('should decode configurations section', () => {
    const config = { isLazy: 'true', test: '123' };
    const jsonStr = JSON.stringify(config);
    const content = Buffer.from(jsonStr, 'utf16le'); // Configuration is utf16le JSON

    const buffer = createTemplate({
      sections: [
        {
          label: TemplateSectionLabel.Configurations,
          content: new Uint8Array(content),
        },
      ],
    });

    const result = decodeTemplate(buffer);
    expect(result.config).toEqual(config);
  });

  it('should decode lepus code section', () => {
    const lepusMap = { 'entry.js': 'console.log("hello")' };
    const content = encodeBinaryMap(lepusMap);

    const buffer = createTemplate({
      sections: [
        { label: TemplateSectionLabel.LepusCode, content },
      ],
    });

    const result = decodeTemplate(buffer);
    expect(String.fromCharCode(...result.lepusCode['entry.js'])).toEqual(
      lepusMap['entry.js'],
    );
  });

  it('should decode style info', () => {
    const content = new Uint8Array([1, 2, 3]);
    // Mock wasmInstance.decode_style_info to return content
    // In this test file setup, the mock simply returns the input buffer, so we expect [1, 2, 3] back but as a distinct array if copied, or same.
    // Our mock implementation: (buffer) => buffer

    const buffer = createTemplate({
      sections: [
        { label: TemplateSectionLabel.StyleInfo, content },
      ],
    });

    const result = decodeTemplate(buffer);
    // It should call wasmInstance.decode_style_info
    expect(wasm.decode_style_info).toHaveBeenCalled();
    expect(result.styleInfo).toEqual(content);
  });

  it('should handle custom sections', () => {
    const customObj = { custom: 'data' };
    const jsonStr = JSON.stringify(customObj);
    const customData = new Uint8Array(Buffer.from(jsonStr, 'utf16le'));

    const buffer = createTemplate({
      sections: [
        { label: TemplateSectionLabel.CustomSections, content: customData },
      ],
    });

    const result = decodeTemplate(buffer);
    expect(result.customSections).toEqual(customObj);
  });
});

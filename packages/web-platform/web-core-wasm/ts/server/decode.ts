import { TemplateSectionLabel, MagicHeader } from '../constants.js';

import { decode_style_info } from './wasm.js';
import { decodeBinaryMap } from '../common/decodeUtils.js';

export interface DecodedTemplate {
  config: Record<string, any>;
  styleInfo?: Uint8Array;
  lepusCode: Record<string, Uint8Array>;
  customSections?: Uint8Array;
}

export function decodeTemplate(buffer: Uint8Array): DecodedTemplate {
  if (buffer.length < 8) {
    throw new Error('Buffer too short for Magic Header');
  }

  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
  const magic = view.getBigUint64(0, true); // Little Endian

  if (magic !== BigInt(MagicHeader)) {
    throw new Error('Invalid Magic Header');
  }

  let offset = 8;

  // Version
  if (buffer.length < offset + 4) {
    throw new Error('Unexpected EOF reading version');
  }
  const version = view.getUint32(offset, true);
  offset += 4;

  if (version > 1) {
    throw new Error(`Unsupported version: ${version}`);
  }

  let config: Record<string, any> = {};
  let styleInfo: Uint8Array | undefined;
  let lepusCode: Record<string, Uint8Array> = {};
  let customSections: Uint8Array | undefined;

  while (offset < buffer.length) {
    if (buffer.length < offset + 4) {
      break; // EOF or partial
    }
    const label = view.getUint32(offset, true);
    offset += 4;

    if (buffer.length < offset + 4) {
      throw new Error('Unexpected EOF reading section length');
    }
    const length = view.getUint32(offset, true);
    offset += 4;

    if (buffer.length < offset + length) {
      throw new Error(
        `Unexpected EOF reading section content. Expected ${length} bytes.`,
      );
    }

    const content = buffer.subarray(offset, offset + length);
    offset += length;

    switch (label) {
      case TemplateSectionLabel.Configurations: {
        const decoder = new TextDecoder('utf-16le');
        const jsonString = decoder.decode(content);
        config = JSON.parse(jsonString);
        break;
      }
      case TemplateSectionLabel.StyleInfo: {
        const buffer = decode_style_info(
          content,
          config['isLazy'] === 'true' ? '' : undefined, // URL is not available in synchronous decode usually, or passed as arg? The user req says "uint8array as params decode directly". Assuming URL is empty or unneeded for sync server decode unless specified.
          config['enableCSSSelector'] === 'true',
        );
        styleInfo = buffer;
        break;
      }
      case TemplateSectionLabel.LepusCode: {
        lepusCode = decodeBinaryMap(content);
        break;
      }
      case TemplateSectionLabel.CustomSections: {
        customSections = content;
        break;
      }
      default:
        // Ignore unknown sections or throw? Worker throws.
        throw new Error(`Unknown section label: ${label}`);
    }
  }

  return {
    config,
    styleInfo,
    lepusCode,
    customSections,
  };
}

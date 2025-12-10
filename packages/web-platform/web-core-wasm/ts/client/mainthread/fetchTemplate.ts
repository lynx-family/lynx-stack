/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TemplateSectionLabel, MagicHeader } from '../../constants.js';
import { templateManager } from '../wasm.js';
import type { LynxViewInstance } from './LynxViewInstance.js';

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

async function handleStream(
  url: string,
  stream: ReadableStreamBYOBReader | ReadableStreamDefaultReader,
  isBYOB: boolean,
  lynxViewInstance: LynxViewInstance,
) {
  templateManager.createTemplate(url);
  const reader = new StreamReader(stream, isBYOB);

  try {
    // 1. Check MagicHeader
    const headerBytes = await reader.read(8);
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
    const versionBytes = await reader.read(4);
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
      const labelBytes = await reader.read(4);
      if (!labelBytes) {
        break; // EOF
      }
      const labelView = new DataView(
        labelBytes.buffer,
        labelBytes.byteOffset,
        labelBytes.byteLength,
      );
      const label = labelView.getUint32(0, true);

      const lengthBytes = await reader.read(4);
      if (!lengthBytes) {
        throw new Error('Unexpected EOF reading section length');
      }
      const lengthView = new DataView(
        lengthBytes.buffer,
        lengthBytes.byteOffset,
        lengthBytes.byteLength,
      );
      const length = lengthView.getUint32(0, true);

      const content = await reader.read(length);
      if (!content) {
        throw new Error(
          `Unexpected EOF reading section content. Expected ${length} bytes.`,
        );
      }

      // 4. Call corresponding method
      switch (label) {
        case TemplateSectionLabel.Configurations:
          templateManager.setConfig(url, content);
          lynxViewInstance.onPageConfigReady();
          break;
        case TemplateSectionLabel.StyleInfo:
          templateManager.setStyleInfo(url, content);
          lynxViewInstance.onStyleInfoReady();
          break;
        case TemplateSectionLabel.LepusCode:
          templateManager.setLepusCode(url, content);
          break;
        case TemplateSectionLabel.ElementTemplates:
          templateManager.setElementTemplateSection(url, content);
          break;
        case TemplateSectionLabel.CustomSections: {
          const textDecoder = new TextDecoder();
          const jsonStr = textDecoder.decode(content);
          const customSections = JSON.parse(jsonStr);
          templateManager.setCustomSection(url, customSections);
          lynxViewInstance.onMTSScriptsLoaded();
          break;
        }
        case TemplateSectionLabel.Manifest:
          break;
        default:
          throw new Error(`Unknown section label: ${label}`);
      }
    }
  } catch (error) {
    // 5. If exception occurs, remove template
    templateManager.removeTemplate(url);
    throw error;
  }
}

export function fetchTemplate(
  url: string,
  signal: AbortSignal,
  lynxViewInstance: LynxViewInstance,
): Promise<void> {
  return fetch(url, { signal }).then(async (response) => {
    if (!response.body) {
      return;
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
    }
    await handleStream(url, reader, isBYOB, lynxViewInstance);
  });
}

/**
 * Copyright (c) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type * as CSS from '@lynx-js/css-serializer';
import type {
  ElementTemplateAsset,
  ElementTemplateElementNode,
  ElementTemplateNode,
} from '../types/index.js';
import { encodeCSS } from './encodeCSS.js';
import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../constants.js';

function encodeAsJSON(value: unknown): Uint8Array {
  const jsonString = JSON.stringify(value);
  const utf16Array = new Uint16Array(jsonString.length);
  for (let i = 0; i < jsonString.length; i++) {
    utf16Array[i] = jsonString.charCodeAt(i);
  }
  return new Uint8Array(utf16Array.buffer);
}

function encodeStringMap(map: Record<string, string>): Uint8Array {
  const entries = Object.entries(map);
  const count = entries.length;

  // Calculate size
  let size = 4; // count
  const encoder = new TextEncoder();
  const encodedEntries: { keyBytes: Uint8Array; valBytes: Uint8Array }[] = [];

  for (const [key, val] of entries) {
    const keyBytes = encoder.encode(key);
    const valBytes = encoder.encode(val);
    encodedEntries.push({ keyBytes, valBytes });
    size += 4 + keyBytes.length + 4 + valBytes.length;
  }

  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);
  let offset = 0;

  view.setUint32(offset, count, true);
  offset += 4;

  for (const { keyBytes, valBytes } of encodedEntries) {
    view.setUint32(offset, keyBytes.length, true);
    offset += 4;
    buffer.set(keyBytes, offset);
    offset += keyBytes.length;

    view.setUint32(offset, valBytes.length, true);
    offset += 4;
    buffer.set(valBytes, offset);
    offset += valBytes.length;
  }

  return buffer;
}

function writeSection(
  buffer: Uint8Array,
  dataView: DataView,
  offset: number,
  label: number,
  content: Uint8Array,
): number {
  dataView.setUint32(offset, label, true);
  offset += 4;
  dataView.setUint32(offset, content.length, true);
  offset += 4;
  buffer.set(content, offset);
  return offset + content.length;
}

export type TasmJSONInfo = {
  styleInfo: Record<string, CSS.LynxStyleNode[]>;
  manifest: Record<string, string>;
  cardType: string;
  appType: string;
  pageConfig: Record<string, unknown>;
  lepusCode: Record<string, string>;
  customSections: Record<string, {
    type?: 'lazy';
    content: string | Record<string, unknown>;
  }>;
  elementTemplates?:
    | Array<ElementTemplateAsset & { sourceFile?: string }>
    | Record<string, ElementTemplateElementNode>;
};

export function encode(tasmJSON: TasmJSONInfo): Uint8Array {
  const {
    styleInfo,
    manifest,
    cardType,
    appType,
    pageConfig,
    lepusCode,
    customSections,
    elementTemplates: rawElementTemplates,
  } = tasmJSON;
  const elementTemplates = !rawElementTemplates
    ? []
    : Array.isArray(rawElementTemplates)
    ? rawElementTemplates.map(({ templateId, compiledTemplate }) => ({
      templateId,
      compiledTemplate,
    }))
    : Object.entries(rawElementTemplates).map((
      [templateId, compiledTemplate],
    ) => ({
      templateId,
      compiledTemplate,
    }));
  for (const { templateId, compiledTemplate } of elementTemplates) {
    const stack: ElementTemplateNode[] = [compiledTemplate];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.kind !== 'element') {
        continue;
      }
      if (node.type === 'page') {
        throw new Error(
          `Element template "${templateId}" cannot contain <page />.`,
        );
      }
      if (node.children) {
        stack.push(...node.children);
      }
    }
  }
  const encodedStyleInfo = encodeCSS(styleInfo);
  const encodedManifest = encodeStringMap(manifest);
  const encodedLepusCode = encodeStringMap(lepusCode);

  const encodedCustomSections = encodeAsJSON(customSections);
  const encodedElementTemplates = elementTemplates.length > 0
    ? encodeAsJSON(elementTemplates)
    : undefined;

  const configMap: Record<string, string> = {};
  configMap['cardType'] = cardType;
  configMap['isLazy'] = appType !== 'card' ? 'true' : 'false';
  for (const [key, value] of Object.entries(pageConfig)) {
    configMap[key] = String(value);
  }
  const encodedConfigurations = encodeAsJSON(configMap);

  const bufferLength = 8 // Magic Header
    + 4 // Version
    /*section label*/
    /*section length*/
    + 4 + 4 + encodedConfigurations.length // Configurations
    + (encodedElementTemplates
      ? 4 + 4 + encodedElementTemplates.length
      : 0) // Element Templates
    + 4 + 4 + encodedLepusCode.length // Lepus Code
    + 4 + 4 + encodedCustomSections.length // Custom Sections
    + 4 + 4 + encodedStyleInfo.length // Style Info
    + 4 + 4 + encodedManifest.length // Manifest
  ;

  // generate final buffer in order
  const buffer = new Uint8Array(bufferLength);
  let offset = 0;
  const dataView = new DataView(buffer.buffer);
  dataView.setUint32(offset, MagicHeader0, true);
  offset += 4;
  dataView.setUint32(offset, MagicHeader1, true);
  offset += 4;

  // Version
  dataView.setUint32(offset, 1, true);
  offset += 4;

  offset = writeSection(
    buffer,
    dataView,
    offset,
    TemplateSectionLabel.Configurations,
    encodedConfigurations,
  );

  if (encodedElementTemplates) {
    offset = writeSection(
      buffer,
      dataView,
      offset,
      TemplateSectionLabel.ElementTemplates,
      encodedElementTemplates,
    );
  }

  offset = writeSection(
    buffer,
    dataView,
    offset,
    TemplateSectionLabel.LepusCode,
    encodedLepusCode,
  );
  offset = writeSection(
    buffer,
    dataView,
    offset,
    TemplateSectionLabel.CustomSections,
    encodedCustomSections,
  );
  offset = writeSection(
    buffer,
    dataView,
    offset,
    TemplateSectionLabel.StyleInfo,
    encodedStyleInfo,
  );
  offset = writeSection(
    buffer,
    dataView,
    offset,
    TemplateSectionLabel.Manifest,
    encodedManifest,
  );

  if (offset !== bufferLength) {
    throw new Error(
      `Unexpected encoded bundle length: ${offset}/${bufferLength}`,
    );
  }

  return buffer;
}

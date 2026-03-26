/**
 * Copyright (c) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type * as CSS from '@lynx-js/css-serializer';
import type { ElementTemplateData } from '../types/index.js';
import { encodeCSS } from './encodeCSS.js';
import {
  MagicHeader0,
  MagicHeader1,
  TemplateSectionLabel,
} from '../constants.js';

function encodeAsJSON(map: Record<string, unknown>): Uint8Array {
  const jsonString = JSON.stringify(map);
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
  elementTemplates: Record<string, ElementTemplateData>;
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
  } = tasmJSON;
  const encodedStyleInfo = encodeCSS(styleInfo);
  const encodedManifest = encodeStringMap(manifest);
  const encodedLepusCode = encodeStringMap(lepusCode);

  const encodedCustomSections = encodeAsJSON(customSections);

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
    + 4 + 4 + encodedStyleInfo.length // Style Info
    + 4 + 4 + encodedLepusCode.length // Lepus Code
    + 4 + 4 + encodedCustomSections.length // Custom Sections
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

  // Configurations
  dataView.setUint32(offset, TemplateSectionLabel.Configurations, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedConfigurations.length, true); // section length
  offset += 4;
  buffer.set(encodedConfigurations, offset);
  offset += encodedConfigurations.length;

  // Lepus Code
  dataView.setUint32(offset, TemplateSectionLabel.LepusCode, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedLepusCode.length, true); // section length
  offset += 4;
  buffer.set(encodedLepusCode, offset);
  offset += encodedLepusCode.length;
  // Custom Sections
  dataView.setUint32(offset, TemplateSectionLabel.CustomSections, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedCustomSections.length, true); // section length
  offset += 4;
  buffer.set(encodedCustomSections, offset);
  offset += encodedCustomSections.length;
  // Style Info
  dataView.setUint32(offset, TemplateSectionLabel.StyleInfo, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedStyleInfo.length, true); // section length
  offset += 4;
  buffer.set(encodedStyleInfo, offset);
  offset += encodedStyleInfo.length;
  // Manifest
  dataView.setUint32(offset, TemplateSectionLabel.Manifest, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedManifest.length, true); // section length
  offset += 4;
  buffer.set(encodedManifest, offset);
  offset += encodedManifest.length;

  return buffer;
}

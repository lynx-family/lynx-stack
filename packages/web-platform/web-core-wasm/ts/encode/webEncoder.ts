/**
 * Copyright (c) 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
import type * as CSS from '@lynx-js/css-serializer';
import type { ElementTemplateData } from '../types/index.js';
import { encodeCSS } from './encodeCSS.js';
import { encodeElementTemplates } from './encodeElementTemplate.js';
import { MagicHeader, TemplateSectionLabel } from '../constants.js';
import { CodeSection, Configurations } from '../../binary/encode/encode.js';

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
    elementTemplates,
  } = tasmJSON;
  const encodedStyleInfo = encodeCSS(styleInfo);
  const encodedElementTemplates = encodeElementTemplates(elementTemplates);
  const manifestCodeSection = new CodeSection();
  for (const [key, value] of Object.entries(manifest)) {
    manifestCodeSection.add_code(key, value);
  }
  const encodedManifest = manifestCodeSection.encode();
  const lepusCodeSection = new CodeSection();
  for (const [key, value] of Object.entries(lepusCode)) {
    lepusCodeSection.add_code(key, value);
  }
  const encodedLepusCode = lepusCodeSection.encode();
  // encode custom sections to Uint8Array
  const textEncoder = new TextEncoder();
  const encodedCustomSections = textEncoder.encode(
    JSON.stringify(customSections),
  );
  const configurations = new Configurations();
  configurations.add_config('cardType', cardType);
  configurations.add_config('appType', appType);
  for (const [key, value] of Object.entries(pageConfig)) {
    configurations.add_config(key, String(value));
  }
  const encodedConfigurations = configurations.encode();
  const bufferLength = 8 // Magic Header
    + 4 // Version
    /*section label*/
    /*section length*/
    + 4 + 4 + encodedConfigurations.length // Configurations
    + 4 + 4 + encodedStyleInfo.length // Style Info
    + 4 + 4 + encodedElementTemplates.length // Element Templates
    + 4 + 4 + encodedLepusCode.length // Lepus Code
    + 4 + 4 + encodedCustomSections.length // Custom Sections
    + 4 + 4 + encodedManifest.length // Manifest
  ;

  // generate final buffer in order
  const buffer = new Uint8Array(bufferLength);
  let offset = 0;
  const dataView = new DataView(buffer.buffer);
  dataView.setBigUint64(offset, BigInt(MagicHeader), true);
  offset += 8;

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
  // Style Info
  dataView.setUint32(offset, TemplateSectionLabel.StyleInfo, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedStyleInfo.length, true); // section length
  offset += 4;
  buffer.set(encodedStyleInfo, offset);
  offset += encodedStyleInfo.length;
  // Element Templates
  dataView.setUint32(offset, TemplateSectionLabel.ElementTemplates, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedElementTemplates.length, true); // section length
  offset += 4;
  buffer.set(encodedElementTemplates, offset);
  offset += encodedElementTemplates.length;
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
  // Manifest
  dataView.setUint32(offset, TemplateSectionLabel.Manifest, true); // section label
  offset += 4;
  dataView.setUint32(offset, encodedManifest.length, true); // section length
  offset += 4;
  buffer.set(encodedManifest, offset);
  offset += encodedManifest.length;

  return buffer;
}

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference types="@lynx-js/types" />

import type { Resource } from 'i18next';
import type { AfterExtractPayload } from 'rsbuild-plugin-i18next-extractor';

import { I18N_TRANSLATIONS_SECTION_KEY } from './constants.js';

type TranslationsByLocale =
  AfterExtractPayload['extractedTranslationsByLocale'];

type LynxWithCustomSections = typeof lynx & {
  getCustomSectionSync(sectionKey: string): TranslationsByLocale | undefined;
};

export function toI18nextTranslations(
  translationsByLocale: TranslationsByLocale,
): Resource {
  return Object.fromEntries(
    Object.entries(translationsByLocale).map(([locale, translations]) => [
      locale,
      {
        translation: translations,
      },
    ]),
  );
}

export function loadI18nextTranslations(): Resource {
  const raw = (lynx as LynxWithCustomSections).getCustomSectionSync(
    I18N_TRANSLATIONS_SECTION_KEY,
  );
  const translationsByLocale = raw && typeof raw === 'object' ? raw : {};

  return toI18nextTranslations(translationsByLocale);
}

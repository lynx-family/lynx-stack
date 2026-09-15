// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ApiData, ApiExport, ApiMember } from './generate-api-data.ts';

interface Entry {
  key: string;
  en: string;
}

function collectMember(owner: string, m: ApiMember, out: Entry[]): void {
  const key = `${owner}.${m.name}`;
  if (m.summary) out.push({ key: `${key}.summary`, en: m.summary });
  if (m.remarks) out.push({ key: `${key}.remarks`, en: m.remarks });
  if (m.default !== undefined) {
    out.push({ key: `${key}.default`, en: m.default });
  }
  if (m.deprecated !== undefined) {
    out.push({ key: `${key}.deprecated`, en: m.deprecated });
  }
  m.examples?.forEach((e, i) =>
    out.push({ key: `${key}.example.${i}`, en: e })
  );
  m.params?.forEach(p => {
    if (p.description) {
      out.push({ key: `${key}.params.${p.name}`, en: p.description });
    }
  });
}

function collectExport(e: ApiExport, out: Entry[]): void {
  collectMember('', { ...e, name: e.name }, out);
  const sig = e.signatures?.[0];
  if (sig?.returns.description) {
    out.push({ key: `${e.name}.returns`, en: sig.returns.description });
  }
  for (const m of e.members ?? []) collectMember(e.name, m, out);
}

export function sourceStrings(api: ApiData): Map<string, string> {
  const entries: Entry[] = [];
  for (const e of api.exports) collectExport(e, entries);
  return new Map(entries.map(x => [x.key.replace(/^\./, ''), x.en]));
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * The markup (buildless Lynx XML card) load path, as a lazily loaded chunk.
 *
 * ## Why this is a separate chunk
 *
 * Converting a markup card needs a CSS parser: `xmlToTasmJSON` goes through
 * `@lynx-js/css-serializer`, which re-exports `css-tree`. That is a couple of
 * hundred kilobytes serving a minority of cards, so it must not sit in the eager
 * client chunk. Every import in this file is therefore reachable only through the
 * dynamic `import()` in `loadMarkupTemplate`, which is what puts the parser in an
 * async chunk. Nothing else in `ts/client/` may import this module statically.
 *
 * ## Why it runs on the main thread
 *
 * Bundle and JSON artifacts are decoded in a worker, which then has to ship the
 * result across `postMessage`. A wasm object cannot be structured-cloned, so the
 * style data is serialised to rkyv bytes and immediately deserialised on the
 * other side - two passes that carry no information and exist only because the
 * halves live in different wasm instances.
 *
 * Running here instead removes that boundary rather than optimising it: the
 * `RawStyleInfo` is built in the same wasm instance that will own the
 * `StyleSheetResource`, so `StyleSheetResource.fromRawStyleInfo` can consume it
 * directly and no bundle bytes are ever produced. The worker still fetches and
 * sniffs, because duplicating that would be worse than the one string hop it
 * costs.
 *
 * ## What it deliberately does not do
 *
 * It does not build a `.web.bundle`. `ts/encode/encodeLynxXML.ts` still does that
 * for build-time callers, and both share the conversion in
 * `ts/common/xml/xmlToTasmJSON.ts`, so a markup card's capabilities do not depend
 * on which of the two loaded it.
 */

import * as CSS from '@lynx-js/css-serializer';

import { pushStyleNodes } from '../../../common/css/buildRawStyleInfo.js';
import {
  type DiscardedAtRule,
  xmlToTasmJSON,
} from '../../../common/xml/xmlToTasmJSON.js';
import { MTS_CODE_WRAPPER_PREFIX } from '../../../constants.js';
import type { DecodedTemplate } from '../../../types/DecodedTemplate.js';
import type { PageConfig } from '../../../types/PageConfig.js';

/**
 * The subset of the client wasm build this module needs, passed in rather than
 * imported so that the chunk does not pull in a second copy of the wasm glue -
 * the caller has already awaited it.
 */
export interface MarkupStyleWasm {
  RawStyleInfo: new() => unknown;
  Rule: new(ruleType: string) => unknown;
  RulePrelude: new() => unknown;
  Selector: new() => unknown;
  StyleSheetResource: {
    fromRawStyleInfo(
      rawStyleInfo: unknown,
      document: unknown,
      configEnableCSSSelector: boolean,
      entryName: string | undefined,
      transformVW: boolean,
      transformVH: boolean,
      transformREM: boolean,
    ): unknown;
  };
}

export interface BuildMarkupTemplateOptions {
  transformVW: boolean;
  transformVH: boolean;
  transformREM: boolean;
  overrideConfig?: Partial<PageConfig>;
}

export type BuildMarkupTemplateResult =
  | {
    success: true;
    template: DecodedTemplate;
    /** At-rules the format cannot carry, already reported. */
    discarded: DiscardedAtRule[];
  }
  | { success: false; message: string };

/**
 * Whether to report discarded at-rules on the console.
 *
 * Silence is the failure mode worth guarding against here - an author writes
 * `@property --x`, it vanishes, and the card renders wrong with nothing to go on
 * - but a production runtime should not narrate. `process.env.NODE_ENV` is what
 * every bundler in this repo's toolchain substitutes at build time, so the
 * warnings are eliminated from a production build outright.
 *
 * The `typeof` guard matters: `dist/client` ships as unbundled ESM, so a consumer
 * may load it somewhere `process` does not exist. Staying quiet there is the safe
 * direction to fail, since the alternative is a `ReferenceError` while loading a
 * card.
 */
const reportDiscardedAtRules: boolean = typeof process !== 'undefined'
  && process.env?.['NODE_ENV'] !== 'production';

/**
 * At-rule names already reported, so a card with fifty `@media` blocks produces
 * one line rather than fifty.
 */
const warnedAtRules = new Set<string>();

function reportDiscarded(discarded: DiscardedAtRule[]): void {
  if (!reportDiscardedAtRules) {
    return;
  }
  for (const { name, reason } of discarded) {
    if (warnedAtRules.has(name)) {
      continue;
    }
    warnedAtRules.add(name);
    console.warn(
      reason === 'unrepresentable'
        ? `[lynx-web] ${name} has no representation in the Lynx style format and was dropped from this markup card, along with the rules inside it. It is not supported on any Lynx platform.`
        : reason === 'unsupported'
        ? `[lynx-web] ${name} is not recognised by the Lynx CSS parser and was dropped from this markup card, along with the rules inside it.`
        : `[lynx-web] ${name} with a URL cannot be resolved for a markup card, which owns a single stylesheet, and was dropped.`,
    );
  }
}

/** Exposed for tests, which need each case to start from a clean slate. */
export function resetDiscardedAtRuleReports(): void {
  warnedAtRules.clear();
}

/**
 * Assembles the page config exactly as `webEncoder.encode` does.
 *
 * Kept in step with the encoder on purpose: a markup card loaded here and the
 * same card built into a bundle must reach `onPageConfigReady` with the same
 * values, otherwise the two ways of running one document diverge.
 */
function buildConfig(
  cardType: string,
  appType: string,
  pageConfig: Record<string, unknown>,
  overrideConfig?: Partial<PageConfig>,
): PageConfig {
  const config: Record<string, string> = {};
  config['cardType'] = cardType;
  config['isLazy'] = appType !== 'card' ? 'true' : 'false';
  for (const [key, value] of Object.entries(pageConfig)) {
    config[key] = String(value);
  }
  if (overrideConfig) {
    for (const [key, value] of Object.entries(overrideConfig)) {
      config[key] = String(value);
    }
  }
  return config as unknown as PageConfig;
}

function toBlobURL(parts: BlobPart[]): string {
  return URL.createObjectURL(
    new Blob(parts, { type: 'text/javascript; charset=utf-8' }),
  );
}

/**
 * Turns a Lynx XML markup document into a {@link DecodedTemplate}, in place.
 *
 * `url` is only used to label the generated blobs, so that a stack trace inside a
 * markup card's script points somewhere meaningful.
 */
export function buildMarkupTemplate(
  source: string,
  url: string,
  wasm: MarkupStyleWasm,
  document: unknown,
  options: BuildMarkupTemplateOptions,
): BuildMarkupTemplateResult {
  const converted = xmlToTasmJSON(source);
  if (!converted.success) {
    return { success: false, message: converted.message };
  }
  const { tasmJSON, discarded } = converted;
  reportDiscarded(discarded);

  const config = buildConfig(
    tasmJSON.cardType,
    tasmJSON.appType,
    tasmJSON.pageConfig,
    options.overrideConfig,
  );

  const template: DecodedTemplate = { config };

  // Style. The whole reason this runs on the main thread: `rawStyleInfo` is a
  // wasm object in this instance, so it can be handed over directly.
  const styleEntries = Object.entries(tasmJSON.styleInfo);
  if (styleEntries.length > 0) {
    const rawStyleInfo = new wasm.RawStyleInfo();
    for (const [cssId, nodes] of styleEntries) {
      pushStyleNodes(
        rawStyleInfo as never,
        wasm as never,
        Number(cssId),
        nodes as CSS.LynxStyleNode[],
        {
          // Both were already removed by the conversion, which reports them
          // through `discarded`. Reaching either here would mean the conversion
          // changed, so do not silently absorb it a second time.
          onGroupAtRule: (node) => {
            throw new Error(
              `[lynx-web] internal: a ${node.type} reached the markup style builder, which cannot represent it.`,
            );
          },
          onNonNumericImport: (node) => {
            throw new Error(
              `[lynx-web] internal: an @import of "${node.href}" reached the markup style builder, which cannot resolve it.`,
            );
          },
        },
      );
    }
    template.styleSheet = wasm.StyleSheetResource.fromRawStyleInfo(
      rawStyleInfo,
      document,
      config.enableCSSSelector === 'true',
      // A markup card is always a card, never a lazy entry, so it is never
      // entry-scoped. `buildConfig` pins `isLazy` to `'false'` for the same
      // reason.
      undefined,
      options.transformVW,
      options.transformVH,
      options.transformREM,
    ) as DecodedTemplate['styleSheet'];
  }

  // Main-thread script. A markup card is a non-lazy card, so it takes the bare
  // wrapper with no `module.exports=` prefix - see the decode worker's
  // `LepusCode` case for the cases that do.
  template.lepusCode = Object.fromEntries(
    Object.entries(tasmJSON.lepusCode).map(([key, code]) => [
      key,
      toBlobURL([
        MTS_CODE_WRAPPER_PREFIX,
        code,
        ' \n })()\n//# sourceURL=',
        url,
        '/',
        key,
        '\n',
      ]),
    ]),
  );

  // Background script, unwrapped: `createChunkLoading` runs each bts chunk
  // through `new Function(...)` itself.
  template.backgroundCode = Object.fromEntries(
    Object.entries(tasmJSON.manifest).map(([key, code]) => [
      key,
      toBlobURL([code, '//# sourceURL=', url, '/', key]),
    ]),
  );

  template.customSections = tasmJSON.customSections;

  return { success: true, template, discarded };
}

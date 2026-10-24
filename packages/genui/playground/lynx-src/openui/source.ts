// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Load source URLs on native hosts as well as the outer Web preview. */
export async function loadOpenUIResponse(url: string): Promise<string> {
  // eslint-disable-next-line n/no-unsupported-features/node-builtins -- Fetch is provided by the Lynx host.
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load OpenUI source (${response.status})`);
  }
  const raw = await response.text();
  const marker = '/demos/openui/chat/';
  const index = url.indexOf(marker);
  if (index < 0) return raw;
  const base = url.slice(0, index);
  // Native image loaders need absolute URLs. This applies only to the packaged
  // fixtures; published or user-authored content keeps its original URLs.
  return raw.replace(/(["'])\.\/demos\/openui\/chat\//g, `$1${base}${marker}`);
}

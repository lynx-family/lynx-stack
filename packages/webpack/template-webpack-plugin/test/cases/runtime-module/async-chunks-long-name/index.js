/// <reference types="@rstest/core/globals" />

import(
  './a-very-long-directory-name-to-exceed-the-limit-0/a-very-long-directory-name-to-exceed-the-limit-1/dynamic.js'
);

// A resolved module path is unbounded (a pnpm virtual store directory alone can
// be 200+ characters), but the lazy bundle name becomes a path on the device's
// file system. Past the limit the name collapses to one bounded segment.
it('should shorten an overlong lazy bundle name', () => {
  const names = Object.values(__webpack_require__['lynx_aci']);
  expect(names).toHaveLength(1);

  const [name] = names;
  expect(name).toMatch(
    /^lazy-bundle\/.{1,32}-[0-9a-f]{8}\.[0-9a-f]+\.bundle$/,
  );
  // No directory nesting survives, and the name segment stays bounded.
  const segment = name.slice('lazy-bundle/'.length);
  expect(segment.includes('/')).toBe(false);
  expect(segment.split('.')[0].length).toBeLessThanOrEqual(41);
});

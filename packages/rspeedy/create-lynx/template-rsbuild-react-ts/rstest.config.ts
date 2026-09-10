import { withLynxConfig } from '@lynx-js/react/testing-library/rstest-config';
import { defineConfig } from '@rstest/core';

export default defineConfig({
  extends: withLynxConfig(),
});

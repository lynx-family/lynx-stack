import { defineConfig, js, reactHooksPlugin, ts } from '@rslint/core';

export default defineConfig([
  js.configs.recommended,
  ts.configs.recommended,
  reactHooksPlugin.configs.recommended,
]);

import { defineConfig, js, reactHooksPlugin } from '@rslint/core';

export default defineConfig([
  js.configs.recommended,
  reactHooksPlugin.configs.recommended,
]);

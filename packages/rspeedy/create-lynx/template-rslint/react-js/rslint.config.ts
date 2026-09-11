import { defineConfig, js, reactHooksPlugin, reactPlugin } from '@rslint/core';

export default defineConfig([
  js.configs.recommended,
  reactPlugin.configs.recommended,
  reactHooksPlugin.configs.recommended,
]);

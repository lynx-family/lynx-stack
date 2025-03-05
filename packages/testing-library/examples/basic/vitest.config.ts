import { defineConfig, mergeConfig } from 'vitest/config';
import defaultConfig from '@lynx-js/react-lynx-testing-library/vitest-config';

const config = defineConfig({});

export default defineConfig(mergeConfig(defaultConfig, config));

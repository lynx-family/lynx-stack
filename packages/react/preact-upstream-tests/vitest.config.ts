import { defineConfig } from 'vitest/config';
import { createBaseConfig } from './vitest.shared';

// No-compiler mode: Preact sees raw props ({ className: 'foo' })
// Tests Preact reconciler semantics through the dual-thread pipeline
// without the SWC snapshot transform.
export default defineConfig(createBaseConfig('preact-upstream'));

import type { CompiledFixtureArtifact } from './compiledFixtureCompiler.js';
import {
  clearTemplates,
  registerBuiltinRawTextTemplate,
  registerTemplates,
} from './registry.js';

export function resetCompiledFixtureTemplates(): void {
  clearTemplates();
  registerBuiltinRawTextTemplate();
}

export function installCompiledFixtureTemplates(
  artifact: Pick<CompiledFixtureArtifact, 'elementTemplates'>,
): void {
  if (artifact.elementTemplates.length > 0) {
    registerTemplates(artifact.elementTemplates);
  }
}

export function primeCompiledFixtureTemplates(
  artifact: Pick<CompiledFixtureArtifact, 'elementTemplates'>,
): void {
  resetCompiledFixtureTemplates();
  installCompiledFixtureTemplates(artifact);
}

import type { LynxTemplate } from './LynxModule.js';

export type TemplateLoader = (url: string) => Promise<LynxTemplate>;

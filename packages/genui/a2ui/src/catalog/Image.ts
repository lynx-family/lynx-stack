import { Image } from './Image/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Image', Image as unknown as ComponentRenderer);

export { Image };

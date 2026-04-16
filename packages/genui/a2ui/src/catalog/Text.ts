import { Text } from './Text/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Text', Text as unknown as ComponentRenderer);

export { Text };

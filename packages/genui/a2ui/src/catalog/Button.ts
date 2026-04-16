import { Button } from './Button/index';
import { componentRegistry } from "../core/ComponentRegistry";
import type { ComponentRenderer } from "../core/ComponentRegistry";

componentRegistry.register('Button', Button as unknown as ComponentRenderer);

export { Button };

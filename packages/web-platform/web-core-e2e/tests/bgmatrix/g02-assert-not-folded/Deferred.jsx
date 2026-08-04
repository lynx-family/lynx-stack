import { Background } from '@lynx-js/react';
import { Sk } from './sk.jsx';

// Indirection: the boundary is inside this component, so at the call site
// there is no <Background> element for a compiler to see.
export function Deferred({ id, children }) {
  return <Background fallback={<Sk id={id} />}>{children}</Background>;
}

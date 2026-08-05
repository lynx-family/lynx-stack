import { Background, root } from '@lynx-js/react';
import { BTReady, Island } from '../parts.jsx';

// `p03` written without `<MainThread>`: a `<Background>` whose two arms are
// the same tree. If the boundaries mean what they claim, this is not a third
// behaviour — it is the same frames as `p03`.
root.render(
  <page>
    <Background fallback={<Island id='p14' />}>
      <Island id='p14' />
    </Background>
    <BTReady id='p14' />
  </page>,
);

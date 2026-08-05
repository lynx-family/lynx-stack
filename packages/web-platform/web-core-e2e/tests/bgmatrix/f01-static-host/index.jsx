import { Background, root } from '@lynx-js/react';
import { Real } from './real.jsx';

root.render(
  <page>
    <Background
      fallback={
        <view
          id='sk-a-0'
          style={{ width: '200px', height: '20px', backgroundColor: '#c9d5e3' }}
        />
      }
    >
      <Real id='a' />
    </Background>
  </page>,
);

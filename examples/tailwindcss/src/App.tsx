import { useEffect } from '@lynx-js/react';

import { Section } from './components/index.js';
import { ColorTokensDemo } from './demos/color-tokens.js';
import { EffectsDemo } from './demos/effects.js';
import { FlexboxGridDemo } from './demos/flexbox-grid.js';
import { LayoutDemo } from './demos/layout.js';
import { TextDemo } from './demos/text.js';
import { TransformDemo } from './demos/transform.js';
import { TransitionDemo } from './demos/transition.js';
import './App.css';

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  return (
    <page className='w-full h-full luna-gradient-berry lunaris-light'>
      <scroll-view
        scroll-y
        className='bg-canvas absolute inset-[32px] top-24 shadow-lg rounded-[24px] p-[16px]'
      >
        <Section
          title='Color tokens'
          description='Background and foreground color utilities from the CSS variables.'
        >
          <ColorTokensDemo />
        </Section>

        <Section
          title='Layout'
          description='Display, position, inset, overflow, and visibility utilities.'
        >
          <LayoutDemo />
        </Section>

        <Section
          title='Flexbox and Grid'
          description='Align Content, Justify Content, Grid column, Grid Row'
        >
          <FlexboxGridDemo />
        </Section>

        <Section
          title='Text'
          description='Text alignment, decoration, direction, whitespace, and word-break utilities.'
        >
          <TextDemo />
        </Section>

        <Section
          title='Transform'
          description='Translate, rotate, scale, skew, perspective, and solo transform utilities.'
        >
          <TransformDemo />
        </Section>

        <Section
          title='Effects'
          description='Shadow, background clip, blur, and grayscale utilities.'
        >
          <EffectsDemo />
        </Section>

        <Section
          title='Transition and animation'
          description='Tap each card to verify transition property, duration, delay, easing, and keyframes.'
        >
          <TransitionDemo />
        </Section>
      </scroll-view>
    </page>
  );
}

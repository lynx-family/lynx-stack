import { useState } from '@lynx-js/react';

import Basic from './Basic/index.js';
import BasicPercent from './BasicPercent/index.js';
import BasicSelector from './BasicSelector/index.js';
import ColorInterception from './ColorInterception/index.js';
import iOSSlider from './iOSSlider/index.js';
import Mini from './Mini/index.js';
import MotionValue from './MotionValue/index.js';
import Spring from './Spring/index.js';
import Stagger from './Stagger/index.js';
import Text from './Text/index.js';

import './App.css';

interface CaseItem {
  name: string;
  comp: () => JSX.Element;
}

const CASES: CaseItem[] = [
  {
    name: 'Basic',
    comp: Basic,
  },
  {
    name: 'BasicPercent',
    comp: BasicPercent,
  },
  {
    name: 'Stagger',
    comp: Stagger,
  },
  {
    name: 'ColorInterception',
    comp: ColorInterception,
  },
  {
    name: 'Spring',
    comp: Spring,
  },
  {
    name: 'Text',
    comp: Text,
  },
  {
    name: 'BasicSelector',
    comp: BasicSelector,
  },
  {
    name: 'MotionValue',
    comp: MotionValue,
  },
  {
    name: 'iOSSlider',
    comp: iOSSlider,
  },
  {
    name: 'Mini',
    comp: Mini,
  },
];

export function App() {
  const [current, setCurrent] = useState(0);

  const CurrentComp = CASES[current]?.comp;

  return (
    <view className='container'>
      <view className='button-area'>
        {CASES.map((item, index) => {
          return (
            <view
              key={item.name}
              className='button'
              bindtap={() => setCurrent(index)}
            >
              <text>{item.name}</text>
            </view>
          );
        })}
      </view>
      <text className='text-area'>Current case is: {CASES[current]?.name}</text>
      <view className='case-area'>
        {CurrentComp && <CurrentComp />}
      </view>
    </view>
  );
}

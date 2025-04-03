import { useCallback, useEffect, useState } from '@lynx-js/react';

import './App.css';
import arrow from './assets/arrow.png';
import lynxLogo from './assets/lynx-logo.png';
import reactLynxLogo from './assets/react-logo.png';

export function App() {
  const [alterLogo, setAlterLogo] = useState(false);

  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const onTap = useCallback(() => {
    'background-only';
    setAlterLogo(!alterLogo);
  }, [alterLogo]);

  return (
    <list
      scroll-orientation='vertical'
      style={{
        width: '100%',
        height: '100vh',
        listMainAxisGap: '5px',
        padding: '10px',
      }}
      custom-list-name={'list-container'}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        return (
          <list-item
            item-key={`list-item-${index}`}
            key={`list-item-${index}`}
            style={{
              width: '100%',
              height: '30vh',
            }}
          >
            <list
              scroll-orientation='horizontal'
              style={{
                width: '100%',
                height: '100%',
                backgroundColor: 'rgb(60, 179, 113)'
              }}
              custom-list-name={'list-container'}
            >
              {Array.from({ length: 5 }).map((_, index) => {
                return (
                  <list-item
                    item-key={`list-item2-${index}`}
                    key={`list-item2-${index}`}
                    style={{
                      width: '30vw',
                      height: '50%',
                      backgroundColor: 'rgb(43, 141, 240)',
                      border:'solid 2px rgb(255, 255, 255)'
                    }}
                  >
                    <text>Hello, Lynx</text>
                  </list-item>
                );
              })}
            </list>
          </list-item>
        );
      })}
    </list>
  );
}

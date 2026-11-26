import { root } from '@lynx-js/react';

import { MainCard } from './MainCard';
import './main.css';

root.render(<MainCard />);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}

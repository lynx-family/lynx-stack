// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import './App.css';
import logo from '../assets/logo.png';
import styles from './card.module.css';

export function App() {
  return (
    <view className='page'>
      <text className='title'>Hello from the web bundle kit</text>
      <text className={styles.badge}>css module</text>
      <image className='logo' src={logo} />
    </view>
  );
}

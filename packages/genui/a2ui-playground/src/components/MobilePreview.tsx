// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
export function MobilePreview(props: { src: string }) {
  return (
    <div className='phoneWrap'>
      <div className='phoneFrame'>
        <div className='phoneScreen'>
          <div className='phoneStatusBar'>
            <div className='phoneNotch' />
          </div>
          <iframe className='phoneIframe' title='preview' src={props.src} />
          <div className='phoneHomeIndicator'>
            <div className='phoneHomeBar' />
          </div>
        </div>
      </div>
    </div>
  );
}

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ComponentPropsWithoutRef, Ref } from 'react';

interface MobilePreviewProps {
  src: string;
  iframeRef?: Ref<HTMLIFrameElement>;
  onLoad?: ComponentPropsWithoutRef<'iframe'>['onLoad'];
}

export function MobilePreview(props: MobilePreviewProps) {
  return (
    <div className='phoneWrap'>
      <div className='phoneFrame'>
        <div className='phoneChrome'>
          <div className='phoneCamera' />
          <div className='phoneSpeaker' />
        </div>
        <div className='phoneScreen'>
          <iframe
            ref={props.iframeRef}
            className='phoneIframe'
            title='preview'
            src={props.src}
            onLoad={props.onLoad}
          />
        </div>
        <div className='phoneHomeIndicator' />
      </div>
    </div>
  );
}

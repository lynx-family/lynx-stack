// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';
function App() {
  return (
    <view>
      <image
        style='height:50px;width:50px;border-radius:50%;'
        src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAIAAACRXR/mAAABp0lEQVR4nO2YzarqMBRG08bUaicRFIWCmSgUnPj+z+BUEQQrxYBQrdCiVMnPGfTCvehtztmj42CvUUv297GSQAf1VqsV+Tz83xb4P6gFAbUgoBYE1IKAWhBQCwJqQUAtCKgFAbUgfKhWx7283W7ruiaEhGGYJImU8nK5dLtdIUQYht+2v8QJIT9scGlZaz3PWy6XzWtVVff7fbFYVFV1PB5ns5nb6SUOanBd4uPxMMas1+vNZlOW5e12GwwGlFLO+fP5tNY2Y+fzOU1TQsjhcMjzvC1OCGlrgGnVdc0YS5JECJFlmda60/lzur7vG2Oa5+FwaK3d7/fGmNFo1Ba31rY1vOO6RM4555wQEkURY4xSqrVulrTWvv93S+PxeLfbzedzR1wp5Wh4wXVaeZ6naaqUqqrKGBNFUVEUSqnr9RoEged5zZi1VkoZx7GU8t97eYkzxtoa3vEcv0aMMVmWlWUZBMF0Ou33+1LKoigYY0KIXq/XjEkpKaWTyeR0Ommt4zhuizfD7w0wrV/kQz+nqAUBtSCgFgTUgoBaEFALAmpBQC0IqAXhCy1TEI1gV/YFAAAAAElFTkSuQmCC'
      />
    </view>
  );
}
root.render(<App></App>);

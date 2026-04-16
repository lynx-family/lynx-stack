import { useEffect, useState } from '@lynx-js/react';

import './style.css';

export function Image(props: any): any {
  const { id, url } = props;

  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [url]);

  const finalSrc = hasError
    ? 'https://lf3-static.bytednsdoc.com/obj/eden-cn/zalzzh-ukj-lapzild-shpjpmmv-eufs/ljhwZthlaukjlkulzlp/built-in-images/logo.png'
    : url;

  return (
    <image
      key={id}
      src={finalSrc as string}
      className="a2ui-image mediumFeature"
      binderror={() => setHasError(true)}
    />
  );
}

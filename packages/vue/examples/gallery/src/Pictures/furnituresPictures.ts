// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import pic0 from './furnitures/0.png';
import pic1 from './furnitures/1.png';
import pic10 from './furnitures/10.png';
import pic11 from './furnitures/11.png';
import pic12 from './furnitures/12.png';
import pic13 from './furnitures/13.png';
import pic14 from './furnitures/14.png';
import pic2 from './furnitures/2.png';
import pic3 from './furnitures/3.png';
import pic4 from './furnitures/4.png';
import pic5 from './furnitures/5.png';
import pic6 from './furnitures/6.png';
import pic7 from './furnitures/7.png';
import pic8 from './furnitures/8.png';
import pic9 from './furnitures/9.png';

export interface Picture {
  src: string;
  width: number;
  height: number;
}

/**
 * Furniture pictures with dimensions matching the React Gallery original.
 */
export const furnituresPicturesSubArray: Picture[] = [
  { src: pic0, width: 512, height: 429 },
  { src: pic1, width: 511, height: 437 },
  { src: pic2, width: 1024, height: 1589 },
  { src: pic3, width: 510, height: 418 },
  { src: pic4, width: 509, height: 438 },
  { src: pic5, width: 1024, height: 1557 },
  { src: pic6, width: 509, height: 415 },
  { src: pic7, width: 509, height: 426 },
  { src: pic8, width: 1024, height: 1544 },
  { src: pic9, width: 510, height: 432 },
  { src: pic10, width: 1024, height: 1467 },
  { src: pic11, width: 1024, height: 1545 },
  { src: pic12, width: 512, height: 416 },
  { src: pic13, width: 1024, height: 1509 },
  { src: pic14, width: 512, height: 411 },
];

/**
 * Full picture list — repeats the sub-array to simulate a large dataset.
 */
export const furnituresPictures: Picture[] = [
  ...furnituresPicturesSubArray,
  ...furnituresPicturesSubArray,
  ...furnituresPicturesSubArray,
  ...furnituresPicturesSubArray,
  ...furnituresPicturesSubArray,
];

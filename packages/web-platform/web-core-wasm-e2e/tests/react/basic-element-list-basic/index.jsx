// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';

function App() {
  const handleScroll = (e) => {
    console.log(e);
  };
  const handleScrollEnd = (e) => {
    console.log(e);
  };

  return (
    <view class='page'>
      <list
        list-type='single'
        bindscroll={handleScroll}
        bindscrollend={handleScrollEnd}
      >
        <list-item item-key='1' id='1'>
          <text>1</text>
        </list-item>
        <list-item item-key='2' id='2'>
          <text>2</text>
        </list-item>
        <list-item item-key='3' id='3'>
          <text>3</text>
        </list-item>
        <list-item item-key='4' id='4'>
          <text>4</text>
        </list-item>
        <list-item item-key='5' id='5'>
          <text>5</text>
        </list-item>
        <list-item item-key='6' id='6'>
          <text>6</text>
        </list-item>
        <list-item item-key='7' id='7'>
          <text>7</text>
        </list-item>
        <list-item item-key='8' id='8'>
          <text>8</text>
        </list-item>
        <list-item item-key='9' id='9'>
          <text>9</text>
        </list-item>
        <list-item item-key='10' id='10'>
          <text>10</text>
        </list-item>
        <list-item item-key='11' id='11'>
          <text>11</text>
        </list-item>
        <list-item item-key='12' id='12'>
          <text>12</text>
        </list-item>
        <list-item item-key='13' id='13'>
          <text>13</text>
        </list-item>
        <list-item item-key='14' id='14'>
          <text>14</text>
        </list-item>
        <list-item item-key='15' id='15'>
          <text>15</text>
        </list-item>
        <list-item item-key='16' id='16'>
          <text>16</text>
        </list-item>
        <list-item item-key='17' id='17'>
          <text>17</text>
        </list-item>
        <list-item item-key='18' id='18'>
          <text>18</text>
        </list-item>
        <list-item item-key='19' id='19'>
          <text>19</text>
        </list-item>
        <list-item item-key='20' id='20'>
          <text>20</text>
        </list-item>
      </list>
    </view>
  );
}

root.render(<App></App>);

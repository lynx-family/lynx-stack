// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, it, expect } from 'vitest';
import { transformLynxStyles } from '../transformLynxStyles.js';

describe('transformLynxStyles - color gradient handling', () => {
  it('should handle gradient colors correctly', () => {
    const result = transformLynxStyles([
      ['color', 'linear-gradient(green, yellow)'],
      ['background-color', 'red']
    ]);

    const styles = result.transformedStyle;
    
    expect(styles).toContainEqual(['color', 'transparent']);
    expect(styles).toContainEqual(['--lynx-text-bg-color', 'linear-gradient(green, yellow)']);
    expect(styles).toContainEqual(['background-clip', 'text']);
    expect(styles).toContainEqual(['-webkit-background-clip', 'text']);
    expect(styles).toContainEqual(['background-color', 'red']);
  });

  it('should handle normal colors correctly (regression test for background-clip)', () => {
    const result = transformLynxStyles([
      ['color', 'blue'],
      ['background-color', 'red']
    ]);

    const styles = result.transformedStyle;
    
    expect(styles).toContainEqual(['color', 'blue']);
    expect(styles).toContainEqual(['--lynx-text-bg-color', 'initial']);
    expect(styles).toContainEqual(['background-clip', 'border-box']); // Fixed: should be 'border-box', not 'initial'
    expect(styles).toContainEqual(['-webkit-background-clip', 'border-box']); // Fixed: should be 'border-box', not 'initial'
    expect(styles).toContainEqual(['background-color', 'red']);
  });

  it('should handle different gradient types', () => {
    const testCases = [
      'linear-gradient(45deg, red, blue)',
      'radial-gradient(circle, red, blue)',
      'conic-gradient(red, blue)',
      'repeating-linear-gradient(red, blue)'
    ];

    testCases.forEach(gradientValue => {
      const result = transformLynxStyles([['color', gradientValue]]);
      const styles = result.transformedStyle;
      
      expect(styles).toContainEqual(['color', 'transparent']);
      expect(styles).toContainEqual(['--lynx-text-bg-color', gradientValue]);
      expect(styles).toContainEqual(['background-clip', 'text']);
      expect(styles).toContainEqual(['-webkit-background-clip', 'text']);
    });
  });

  it('should handle edge case: color name containing "gradient"', () => {
    const result = transformLynxStyles([
      ['color', 'gradientblue'] // Not a real CSS gradient, but contains "gradient"
    ]);

    const styles = result.transformedStyle;
    
    // This should be treated as a gradient due to the .includes('gradient') check
    expect(styles).toContainEqual(['color', 'transparent']);
    expect(styles).toContainEqual(['--lynx-text-bg-color', 'gradientblue']);
    expect(styles).toContainEqual(['background-clip', 'text']);
    expect(styles).toContainEqual(['-webkit-background-clip', 'text']);
  });

  it('should handle transition from gradient to normal color', () => {
    // Simulate removing gradient and adding normal color
    const gradientResult = transformLynxStyles([
      ['color', 'linear-gradient(red, blue)'],
      ['background-color', 'yellow']
    ]);

    const normalResult = transformLynxStyles([
      ['color', 'black'],
      ['background-color', 'yellow']
    ]);

    // Verify gradient styles
    const gradientStyles = gradientResult.transformedStyle;
    expect(gradientStyles).toContainEqual(['background-clip', 'text']);
    expect(gradientStyles).toContainEqual(['-webkit-background-clip', 'text']);

    // Verify normal styles (the key fix)
    const normalStyles = normalResult.transformedStyle;
    expect(normalStyles).toContainEqual(['background-clip', 'border-box']);
    expect(normalStyles).toContainEqual(['-webkit-background-clip', 'border-box']);
    expect(normalStyles).toContainEqual(['background-color', 'yellow']);
  });
});
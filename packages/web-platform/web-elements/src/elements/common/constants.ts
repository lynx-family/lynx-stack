// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// safari cannot use scrollend event
export const useScrollEnd = 'onscrollend' in document;

export const scrollContainerDom = Symbol.for('lynx-scroll-container-dom');

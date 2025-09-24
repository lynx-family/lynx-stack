/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { add, styles } from './lib-common.js'

import './no-changed.css'

console.log(add(1, 2))

import.meta.webpackHot.accept()

export default styles

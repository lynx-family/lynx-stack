import { root, useEffect, useState } from '@lynx-js/react'
import { __root, options } from '@lynx-js/react/internal'
import { jsx } from '@lynx-js/react/jsx-runtime'
import { jsxDEV } from '@lynx-js/react/jsx-dev-runtime'

export const runtime = {
  root,
  useEffect,
  useState,
  __root,
  options,
  jsx,
  jsxDEV,
}

function Empty() {
  return null
}

export default function LazyBundleComp() {
  return <Empty />
}

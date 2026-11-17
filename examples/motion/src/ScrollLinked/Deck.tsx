// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the root directory of this source tree.

import {
  motion,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
} from '@lynx-js/motion';
import { useState } from '@lynx-js/react';

import './styles.css';

const slides = [
  {
    title: 'Welcome to your\nlynx-motion deck',
    description:
      'Swipe through five scenes to see how one scroll value drives the cards, their colors, and their spring motion.',
  },
  {
    title: 'One value,\nmany outputs',
    description:
      'useTransform maps scroll progress to scale, rotation, and color. useMotionTemplate combines the moving parts into a single style.',
  },
  {
    title: 'The spring follows',
    description:
      'The same card moves and resizes across slides. A spring smooths the handoff as you lift your finger.',
  },
  {
    title: 'Two threads,\none writer',
    description:
      'React declares the style binding. The main thread owns the value, runs the spring, and updates the card during the swipe.',
  },
  {
    title: 'That is the\nwhole model',
    description:
      'Read the scroll position, derive a value, then bind it to a style. The same value can drive several properties together.',
  },
];

const slideCount = slides.length;

interface ScrollPosition {
  detail: { scrollLeft: number; scrollWidth: number };
}

const pages = slides.map((_, index) => index / (slideCount - 1));

function SharedCard(
  { progress }: { progress: ReturnType<typeof useScroll>['scrollXProgress'] },
) {
  const spring = useSpring(progress, { stiffness: 220, damping: 27 });
  const left = useTransform<string>(spring, pages, [
    '27.5%',
    '27.5%',
    '22%',
    '57%',
    '27.5%',
  ]);
  const top = useTransform<string>(spring, pages, [
    '0px',
    '0px',
    '-13px',
    '7px',
    '0px',
  ]);
  const width = useTransform<string>(spring, pages, [
    '45%',
    '45%',
    '56%',
    '45%',
    '45%',
  ]);
  const height = useTransform<string>(spring, pages, [
    '247px',
    '247px',
    '285px',
    '232px',
    '247px',
  ]);
  const angle = useTransform<number>(spring, pages, [-2, -4, 3, 5, -4]);
  const scale = useTransform<number>(spring, [0, 0.125, 0.25, 0.5, 0.75, 1], [
    1,
    0.93,
    1,
    1,
    1,
    1,
  ]);
  const transform = useMotionTemplate`rotate(${angle}deg) scale(${scale})`;
  const backgroundColor = useTransform<string>(spring, pages, [
    '#de2039',
    '#de2039',
    '#de2039',
    '#d2cfce',
    '#222034',
  ]);
  const opacity = useTransform<number>(spring, pages, [1, 1, 1, 1, 0.3]);
  const symbolColor = useTransform<string>(spring, pages, [
    '#ed990e',
    '#ed990e',
    '#ed990e',
    '#9d9a97',
    '#8376b2',
  ]);
  const borderRadius = useTransform<number>(spring, pages, [
    24,
    24,
    24,
    40,
    24,
  ]);

  return (
    <view className='deck-art' event-through={true}>
      <motion.view
        id='deck-shared-card'
        className='deck-card card-main'
        style={{
          left,
          top,
          width,
          height,
          transform,
          backgroundColor,
          opacity,
        }}
      >
        <motion.view
          className='card-symbol'
          style={{ backgroundColor: symbolColor, borderRadius }}
        />
        <view className='card-line' />
      </motion.view>
    </view>
  );
}

function CardFace({ round = false }: { round?: boolean }) {
  return (
    <>
      <view
        className={round ? 'card-symbol card-symbol-round' : 'card-symbol'}
      />
      <view className='card-line' />
    </>
  );
}

function Pill({ className, label }: { className: string; label: string }) {
  return (
    <view className={`deck-pill ${className}`}>
      <text className='deck-pill-text'>{label}</text>
    </view>
  );
}

function Foreground({ index }: { index: number }) {
  return (
    <view className={`deck-overlay-page deck-slide-${index}`}>
      <view className='deck-art'>
        {index === 0 && (
          <Pill className='pill-source' label='One source of truth' />
        )}
        {index === 1 && (
          <>
            <view className='card-accent' />
            <Pill className='pill-map' label='useTransform' />
            <Pill className='pill-template' label='useMotionTemplate' />
            <Pill className='pill-spring' label='useSpring' />
            <Pill className='pill-scroll' label='useScroll' />
          </>
        )}
        {index === 2 && (
          <>
            <Pill className='pill-map' label='scroll position' />
            <Pill className='pill-spring' label='spring follows its target' />
            <Pill className='pill-source' label='one shared element' />
          </>
        )}
        {index === 3 && (
          <>
            <Pill className='pill-spring' label='main thread' />
            <Pill className='pill-scroll' label='background thread' />
          </>
        )}
      </view>
    </view>
  );
}

function Slide({ index, onRestart }: { index: number; onRestart: () => void }) {
  const { title, description } = slides[index]!;

  return (
    <view className={`deck-slide deck-slide-${index}`} flatten={false}>
      <view className='deck-glow' />
      {(index === 0 || index === 3) && (
        <view className='deck-art'>
          <view className='deck-card card-blue'>
            <CardFace round />
          </view>
          {index === 0 && (
            <view className='deck-card card-silver'>
              <CardFace round />
            </view>
          )}
        </view>
      )}
      <view className='deck-copy'>
        <text className='deck-title'>{title}</text>
        <text className='deck-description'>{description}</text>
      </view>
      {index === slideCount - 1 && (
        <view className='deck-restart' bindtap={onRestart}>
          <text className='deck-restart-text'>Back to start</text>
        </view>
      )}
    </view>
  );
}

function scrollToPage(index: number) {
  lynx.createSelectorQuery().select('#motion-deck-scroll').invoke({
    method: 'scrollTo',
    params: { index, smooth: true },
  }).exec();
}

export default function ScrollLinkedExample() {
  const { scrollX, scrollXProgress, onScroll, onLayoutChange } = useScroll();
  const foregroundX = useTransform(scrollX, [0, 1], [0, -1], { clamp: false });
  const foregroundTransform = useMotionTemplate`translateX(${foregroundX}px)`;
  const [active, setActive] = useState(0);

  function onScrollEnd(event: ScrollPosition) {
    const { scrollLeft, scrollWidth } = event.detail;
    if (scrollWidth <= 0) return;
    const pageWidth = scrollWidth / slideCount;
    const next = Math.max(
      0,
      Math.min(slideCount - 1, Math.round(scrollLeft / pageWidth)),
    );
    setActive(next);
    if (Math.abs(scrollLeft - next * pageWidth) > 2) {
      scrollToPage(next);
    }
  }

  return (
    <view className='deck'>
      <scroll-view
        id='motion-deck-scroll'
        className='deck-scroll'
        scroll-orientation='horizontal'
        scroll-bar-enable={false}
        main-thread:bindscroll={onScroll}
        main-thread:bindlayoutchange={onLayoutChange}
        bindscrollend={onScrollEnd}
      >
        {slides.map((slide, index) => (
          <Slide
            key={slide.title}
            index={index}
            onRestart={() => scrollToPage(0)}
          />
        ))}
      </scroll-view>
      <view className='deck-overlay' event-through={true}>
        <SharedCard progress={scrollXProgress} />
        <motion.view
          className='deck-foreground-track'
          style={{ transform: foregroundTransform }}
        >
          {slides.map((slide, index) => (
            <Foreground key={slide.title} index={index} />
          ))}
        </motion.view>
      </view>
      <view className='deck-back' bindtap={() => scrollToPage(0)}>
        <text className='deck-back-text'>‹ Start</text>
      </view>
      <view className='deck-pagination'>
        {slides.map((slide, index) => (
          <view
            key={slide.title}
            id={`deck-page-${index}`}
            className='deck-dot-target'
            bindtap={() => scrollToPage(index)}
          >
            <view
              className={index === active
                ? 'deck-dot deck-dot-active'
                : 'deck-dot'}
            />
          </view>
        ))}
      </view>
    </view>
  );
}

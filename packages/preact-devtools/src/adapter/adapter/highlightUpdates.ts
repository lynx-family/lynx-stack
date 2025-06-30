import { render, h } from 'preact';
import { CanvasHighlight } from '../../view/components/CanvasHighlight/CanvasHighlight';

const DISPLAY_DURATION = 250;
const MAX_DISPLAY_DURATION = 3000;

const OUTLINE_COLOR = '#f0f0f0';
const COLORS = [
  '#37afa9',
  '#63b19e',
  '#80b393',
  '#97b488',
  '#abb67d',
  '#beb771',
  '#cfb965',
  '#dfba57',
  '#efbb49',
  '#febc38',
];

export interface UpdateRect {
  x: number;
  y: number;
  width: number;
  height: number;
  count: number;
  expirationTime: number;
}

export type UpdateRects = Map<HTMLElement, UpdateRect>;

export function measureUpdate(updates: UpdateRects, dom: HTMLElement) {
  const data = updates.get(dom);
  const rect = dom.getBoundingClientRect();

  const now = performance.now();
  const expirationTime = data
    ? Math.min(
      now + MAX_DISPLAY_DURATION,
      data.expirationTime + DISPLAY_DURATION,
    )
    : now + DISPLAY_DURATION;

  updates.set(dom, {
    expirationTime,
    height: rect.height,
    width: rect.width,
    x: rect.x,
    y: rect.y,
    count: data ? data.count + 1 : 1,
  });
}

export function drawRect(ctx: CanvasRenderingContext2D, data: UpdateRect) {
  const colorIndex = Math.min(COLORS.length - 1, data.count - 1);

  // Outline
  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.strokeRect(data.x - 1, data.y - 1, data.width + 2, data.height + 2);

  // Inset
  ctx.lineWidth = 1;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.strokeRect(data.x + 1, data.y + 1, data.width - 2, data.height - 2);

  // Border
  ctx.strokeStyle = COLORS[colorIndex];
  ctx.lineWidth = 1;
  ctx.strokeRect(data.x, data.y, data.width, data.height);
}

let timer: NodeJS.Timeout;

let container: HTMLDivElement | null = null;
let canvas: HTMLCanvasElement | null = null;
export function destroyCanvas() {
  if (container) {
    render(null, container);
    container.remove();
    container = null;
    canvas = null;
  }
}

function draw(updates: UpdateRects) {
  if (!canvas || !canvas.getContext) return;
  if (timer) clearTimeout(timer);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const now = performance.now();
  let nextRedraw = Number.MAX_SAFE_INTEGER;
  updates.forEach((data, key) => {
    if (data.expirationTime < now) {
      updates.delete(key);
    } else {
      drawRect(ctx, data);
      nextRedraw = Math.min(nextRedraw, data.expirationTime);
    }
  });

  if (nextRedraw !== Number.MAX_SAFE_INTEGER) {
    timer = setTimeout(() => draw(updates), nextRedraw - now);
  } else {
    destroyCanvas();
  }
}

export function startDrawing(updateRects: UpdateRects) {
  if (!canvas) {
    container = document.createElement('div');
    container.id = 'preact-devtools-highlight-updates';
    document.body.appendChild(container);

    render(h(CanvasHighlight, null), container);
    canvas = container.querySelector('canvas')!;
  }
  draw(updateRects);
}

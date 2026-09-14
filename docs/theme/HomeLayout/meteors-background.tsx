// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type React from 'react';
import { useEffect, useRef } from 'react';

interface GridBackgroundProps {
  gridSize?: number;
  meteorCount?: number;
}

enum Direction {
  UP = 0,
  RIGHT = 1,
  DOWN = 2,
  LEFT = 3,
}

class Meteor {
  x = 0;
  y = 0;
  direction: Direction = Direction.UP;
  speed = 0;
  length = 0;
  opacity = 0;
  gridSize: number;
  canvas: HTMLCanvasElement;

  constructor(gridSize: number, canvass: HTMLCanvasElement) {
    this.gridSize = gridSize;
    this.canvas = canvass;
    this.reset();
  }

  reset() {
    this.direction = Math.floor(Math.random() * 4);
    this.speed = 2 + Math.random() * 3;
    this.length = this.gridSize * (1 + Math.random() * 2);
    this.opacity = 0.6 + Math.random() * 0.4;

    const getMiddlePosition = (size: number) => {
      const margin = size * 0.2;
      return margin + Math.random() * (size * 0.6);
    };

    switch (this.direction) {
      case Direction.UP:
        this.x =
          Math.floor(getMiddlePosition(this.canvas.width) / this.gridSize)
          * this.gridSize;
        this.y = this.canvas.height;
        break;
      case Direction.RIGHT:
        this.x = 0;
        this.y =
          Math.floor(getMiddlePosition(this.canvas.height) / this.gridSize)
          * this.gridSize;
        break;
      case Direction.DOWN:
        this.x =
          Math.floor(getMiddlePosition(this.canvas.width) / this.gridSize)
          * this.gridSize;
        this.y = 0;
        break;
      case Direction.LEFT:
        this.x = this.canvas.width;
        this.y =
          Math.floor(getMiddlePosition(this.canvas.height) / this.gridSize)
          * this.gridSize;
        break;
    }
  }

  update() {
    switch (this.direction) {
      case Direction.UP:
        this.y -= this.speed;
        if (this.y + this.length < 0) this.reset();
        break;
      case Direction.RIGHT:
        this.x += this.speed;
        if (this.x > this.canvas.width) this.reset();
        break;
      case Direction.DOWN:
        this.y += this.speed;
        if (this.y > this.canvas.height) this.reset();
        break;
      case Direction.LEFT:
        this.x -= this.speed;
        if (this.x + this.length < 0) this.reset();
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const startX = this.x;
    const startY = this.y;
    let endX = this.x;
    let endY = this.y;

    switch (this.direction) {
      case Direction.UP:
        endY = this.y + this.length;
        break;
      case Direction.RIGHT:
        endX = this.x - this.length;
        break;
      case Direction.DOWN:
        endY = this.y - this.length;
        break;
      case Direction.LEFT:
        endX = this.x + this.length;
        break;
    }

    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, `rgba(18, 229, 229, ${this.opacity})`);
    gradient.addColorStop(0.02, `rgba(18, 229, 229, ${this.opacity * 0.8})`);
    gradient.addColorStop(0.05, `rgba(255, 53, 26, ${this.opacity * 0.6})`);
    gradient.addColorStop(1, `rgba(255, 53, 26, 0)`);

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

const MeteorsBackground: React.FC<GridBackgroundProps> = ({
  gridSize = 30,
  meteorCount = 20,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight * 0.65;
    };
    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    const meteors = Array.from(
      { length: meteorCount },
      () => new Meteor(gridSize, canvas),
    );

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(128, 128, 128, 0.1)';
      ctx.lineWidth = 1;

      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      meteors.forEach((meteor) => {
        meteor.update();
        meteor.draw(ctx);
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
    };
  }, [gridSize, meteorCount]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '65vh',
        zIndex: -1,
      }}
    />
  );
};

export { MeteorsBackground };

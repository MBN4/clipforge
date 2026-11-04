"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const GRID = 18;
const CELL = 18;
const SIZE = GRID * CELL;
const BASE_SPEED = 140;

type Point = { x: number; y: number };

function randomFood(snake: Point[]): Point {
  while (true) {
    const p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

export function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snakeRef = useRef<Point[]>([{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }]);
  const dirRef = useRef<Point>({ x: 1, y: 0 });
  const nextDirRef = useRef<Point>({ x: 1, y: 0 });
  const foodRef = useRef<Point>(randomFood(snakeRef.current));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#141210";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.strokeStyle = "rgba(245,239,227,0.04)";
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(SIZE, i * CELL);
      ctx.stroke();
    }

    const food = foodRef.current;
    ctx.fillStyle = "#cdfb5e";
    ctx.shadowColor = "#cdfb5e";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    snakeRef.current.forEach((seg, i) => {
      const r = i === 0 ? 6 : 4;
      ctx.fillStyle = i === 0 ? "#ff4e1f" : "rgba(255,78,31,0.75)";
      ctx.beginPath();
      ctx.roundRect(seg.x * CELL + 1.5, seg.y * CELL + 1.5, CELL - 3, CELL - 3, r);
      ctx.fill();
    });
  }, []);

  const tick = useCallback(() => {
    dirRef.current = nextDirRef.current;
    const snake = snakeRef.current;
    const head = { x: snake[0].x + dirRef.current.x, y: snake[0].y + dirRef.current.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);

    if (hitWall || hitSelf) {
      setGameOver(true);
      setRunning(false);
      setBest((b) => Math.max(b, snake.length - 3));
      return;
    }

    const newSnake = [head, ...snake];
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      foodRef.current = randomFood(newSnake);
      setScore((s) => s + 1);
    } else {
      newSnake.pop();
    }
    snakeRef.current = newSnake;
    draw();
  }, [draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    if (!running) return;
    const speed = Math.max(70, BASE_SPEED - score * 3);
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [running, tick, score]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const d = dirRef.current;
      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
      const next = map[e.key];
      if (!next) return;
      e.preventDefault();
      if (next.x === -d.x && next.y === -d.y) return;
      nextDirRef.current = next;
      if (!running && !gameOver) setRunning(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, gameOver]);

  function restart() {
    snakeRef.current = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
    dirRef.current = { x: 1, y: 0 };
    nextDirRef.current = { x: 1, y: 0 };
    foodRef.current = randomFood(snakeRef.current);
    setScore(0);
    setGameOver(false);
    setRunning(true);
    draw();
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="rounded-xl border border-line-strong shadow-xl shadow-black/40"
        />
        {(!running && !gameOver) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-ink/70 backdrop-blur-sm">
            <p className="text-sm font-medium text-paper">Press an arrow key</p>
            <p className="font-mono text-[11px] text-paper-dim">or WASD to start</p>
          </div>
        )}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-ink/85 backdrop-blur-sm">
            <p className="font-display text-lg font-semibold text-paper">Game over</p>
            <p className="font-mono text-xs text-paper-dim">Score: {score}</p>
            <button
              onClick={restart}
              className="rounded-full bg-ember px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-110"
            >
              Play again
            </button>
          </div>
        )}
      </div>
      <div className="flex w-full items-center justify-between font-mono text-xs text-paper-dim" style={{ width: SIZE }}>
        <span>Score: {score}</span>
        <span>Best: {best}</span>
      </div>
    </div>
  );
}

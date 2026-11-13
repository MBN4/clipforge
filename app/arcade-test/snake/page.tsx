"use client";
import { SnakeGame } from "@/components/games/snake/SnakeGame";
export default function Page() {
  return (
    <div className="@container mx-auto w-full max-w-3xl p-4">
      <SnakeGame />
    </div>
  );
}

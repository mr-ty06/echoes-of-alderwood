"use client";

import { useEffect, useRef } from "react";

export default function GameClient() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cleanup = () => {};
    let alive = true;

    void import("../game.js").then(({ startGame }) => {
      if (!alive || !mountRef.current) {
        return;
      }
      cleanup = startGame(mountRef.current);
    });

    return () => {
      alive = false;
      cleanup();
    };
  }, []);

  return <div ref={mountRef} className="game-mount" />;
}


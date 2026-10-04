import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { GameBridge } from "../core/gameBridge";
import { GameRuntime } from "../game/GameRuntime";
import { HUD } from "../ui/HUD";

export function App() {
  const bridge = useMemo(() => new GameBridge(), []);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    return bridge.events.on("ui:command", ({ command }) => {
      if (command === "pause") setPaused(true);
      if (command === "resume") setPaused(false);
      if (command === "toggle-pause") setPaused((value) => !value);
    });
  }, [bridge]);

  useEffect(() => {
    bridge.setStatus(paused ? "paused" : "running");
  }, [bridge, paused]);

  return (
    <main className="app-shell">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 62, near: 0.05, far: 500, position: [6, 4, 14] }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <GameRuntime bridge={bridge} paused={paused} />
      </Canvas>
      <HUD bridge={bridge} />
    </main>
  );
}
import { useMemo, useSyncExternalStore } from "react";
import type { GameBridge } from "../core/gameBridge";

export function HUD({ bridge }: { bridge: GameBridge }) {
  const snapshot = useSyncExternalStore(
    bridge.subscribe,
    bridge.getSnapshot,
    bridge.getSnapshot,
  );

  const speed = useMemo(
    () => Math.round(snapshot.player.speed * 3.6),
    [snapshot.player.speed],
  );

  return (
    <>
      <div className="boot" data-hidden={snapshot.status !== "booting"}>
        <strong>GYTT</strong>
        <span>INITIALIZING R3F RUNTIME</span>
        <i />
      </div>

      <div className="hud">
        <header>
          <strong>GYTT / R3F</strong>
          <span>{snapshot.status === "paused" ? "PAUSED" : "FREE ROAM"}</span>
          <span>{snapshot.fps || "--"} FPS</span>
          <button
            onClick={() => bridge.command("toggle-pause")}
            aria-label="Pause or resume game"
          >
            {snapshot.status === "paused" ? "RESUME" : "PAUSE"}
          </button>
        </header>

        <section>
          <small>DEV BUILD · REACT THREE FIBER</small>
          <strong>Explore the house and shed</strong>
          <span>
            {snapshot.player.state.toUpperCase()} · {speed} KM/H
          </span>
        </section>

        <footer>
          <span>WASD / STICK</span>
          <span>SHIFT SPRINT</span>
          <span>SPACE JUMP</span>
          <span>E INTERACT</span>
        </footer>
      </div>

      <div className="crosshair">·</div>

      <div className="mobile-ui">
        <div id="move-stick" className="stick">
          <span className="stick-knob" />
          <b>MOVE</b>
        </div>

        <div id="look-stick" className="stick">
          <span className="stick-knob" />
          <b>LOOK</b>
        </div>

        <div className="actions">
          <button data-action="jump">JUMP</button>
          <button data-action="crouch">CROUCH</button>
          <button data-action="run">RUN</button>
          <button data-action="interact">USE</button>
        </div>
      </div>
    </>
  );
}
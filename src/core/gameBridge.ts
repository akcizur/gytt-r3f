import { EventBus, type GameEventMap } from "./eventBus";

export type PlayerSnapshot = {
  state: GameEventMap["player:state"]["state"];
  speed: number;
  grounded: boolean;
  position: { x: number; y: number; z: number };
  yaw: number;
};

export type GameSnapshot = {
  status: GameEventMap["game:status"]["status"];
  player: PlayerSnapshot;
  fps: number;
};

export class GameBridge {
  readonly events = new EventBus<GameEventMap>();

  private snapshot: GameSnapshot = {
    status: "booting",
    player: {
      state: "idle",
      speed: 0,
      grounded: true,
      position: { x: 0, y: 0, z: 8 },
      yaw: 0
    },
    fps: 0
  };

  private readonly listeners = new Set<() => void>();
  private lastNotify = 0;

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setStatus(status: GameSnapshot["status"]) {
    if (this.snapshot.status === status) return;
    this.snapshot = { ...this.snapshot, status };
    this.events.emit("game:status", { status });
    this.notify();
  }

  publishPlayer(player: PlayerSnapshot, fps: number) {
    this.snapshot = {
      ...this.snapshot,
      player: { ...player, position: { ...player.position } },
      fps
    };
    const now = performance.now();
    if (now - this.lastNotify >= 75) this.notify();
  }

  command(command: GameEventMap["ui:command"]["command"]) {
    this.events.emit("ui:command", { command });
  }

  destroy() {
    this.snapshot = { ...this.snapshot, status: "disposed" };
    this.notify();
    this.events.clear();
    this.listeners.clear();
  }

  private notify() {
    this.lastNotify = performance.now();
    this.listeners.forEach((listener) => listener());
  }
}
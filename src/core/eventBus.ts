export type GameEventMap = {
  "game:status": { status: "booting" | "running" | "paused" | "disposed" };
  "player:state": {
    state: "idle" | "walk" | "jog" | "run" | "crouch" | "jump" | "fall";
    speed: number;
    grounded: boolean;
  };
  "player:transform": { x: number; y: number; z: number; yaw: number };
  "ui:command": { command: "pause" | "resume" | "toggle-pause" | "interact" };
};

type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<any>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<any>);
    return () => this.off(event, listener);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  clear() {
    this.listeners.clear();
  }

  private off<K extends keyof Events>(event: K, listener: Listener<Events[K]>) {
    const set = this.listeners.get(event);
    if (!set) return;
    set.delete(listener as Listener<any>);
    if (set.size === 0) this.listeners.delete(event);
  }
}
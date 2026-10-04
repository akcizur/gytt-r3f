export type InputActions = {
  moveX: number; moveY: number; lookX: number; lookY: number;
  sprint: boolean; jump: boolean; crouch: boolean; roll: boolean; interact: boolean;
};

const clamp = (value: number, min = -1, max = 1) => Math.max(min, Math.min(max, value));
const deadzone = (value: number, zone = 0.08) => {
  const magnitude = Math.abs(value);
  if (magnitude <= zone) return 0;
  const normalized = Math.min(1, (magnitude - zone) / (1 - zone));
  const curved = normalized * normalized * (3 - 2 * normalized);
  return Math.sign(value) * curved;
};

type StickKind = "move" | "look";

export class InputSystem {
  readonly actions: InputActions = {
    moveX: 0, moveY: 0, lookX: 0, lookY: 0,
    sprint: false, jump: false, crouch: false, roll: false, interact: false
  };

  private canvas: HTMLCanvasElement | null = null;
  private readonly keys = new Set<string>();
  private readonly justPressed = new Set<string>();
  private readonly virtual = new Set<"jump" | "crouch" | "run" | "interact">();
  private readonly cleanups: Array<() => void> = [];
  private readonly activeStick: Record<StickKind, number | null> = { move: null, look: null };
  private readonly pointers = new Map<number, { kind: StickKind; x: number; y: number }>();
  private readonly sticks = { moveX: 0, moveY: 0 };
  private disposed = false;

  attach(canvas: HTMLCanvasElement) {
    if (this.disposed || this.canvas) return;
    this.canvas = canvas;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!this.keys.has(event.code)) this.justPressed.add(event.code);
      this.keys.add(event.code);
      if (event.code === "Space" || event.code.startsWith("Arrow")) event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
    const onBlur = () => this.reset();
    const onVisibility = () => document.hidden && this.reset();
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      this.actions.lookX += event.movementX * 0.0022;
      this.actions.lookY += event.movementY * 0.0020;
    };
    const requestPointerLock = () => {
      if (matchMedia("(pointer:fine)").matches) canvas.requestPointerLock?.();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", requestPointerLock);

    this.cleanups.push(() => window.removeEventListener("keydown", onKeyDown));
    this.cleanups.push(() => window.removeEventListener("keyup", onKeyUp));
    this.cleanups.push(() => window.removeEventListener("blur", onBlur));
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisibility));
    this.cleanups.push(() => window.removeEventListener("mousemove", onMouseMove));
    this.cleanups.push(() => canvas.removeEventListener("click", requestPointerLock));

    const actionMap: Record<string, "jump" | "crouch" | "run" | "interact"> = {
      jump: "jump", crouch: "crouch", run: "run", interact: "interact"
    };

    document.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => {
      const action = actionMap[element.dataset.action ?? ""];
      if (!action) return;
      const down = (event: PointerEvent) => {
        event.preventDefault();
        this.virtual.add(action);
        this.justPressed.add(action);
        element.setPointerCapture?.(event.pointerId);
      };
      const up = () => this.virtual.delete(action);

      element.addEventListener("pointerdown", down, { passive: false });
      element.addEventListener("pointerup", up);
      element.addEventListener("pointercancel", up);
      element.addEventListener("lostpointercapture", up);
      this.cleanups.push(() => element.removeEventListener("pointerdown", down));
      this.cleanups.push(() => element.removeEventListener("pointerup", up));
      this.cleanups.push(() => element.removeEventListener("pointercancel", up));
      this.cleanups.push(() => element.removeEventListener("lostpointercapture", up));
    });

    this.bindStick("#move-stick", "move");
    this.bindStick("#look-stick", "look");
  }

  sample(): InputActions {
    const gamepad = navigator.getGamepads?.().find(Boolean);
    const gamepadMoveX = deadzone(gamepad?.axes[0] ?? 0);
    const gamepadMoveY = deadzone(-(gamepad?.axes[1] ?? 0));
    const keyX = (this.down("KeyD") ? 1 : 0) - (this.down("KeyA") ? 1 : 0);
    const keyY = (this.down("KeyW") ? 1 : 0) - (this.down("KeyS") ? 1 : 0);
    const keyboardMagnitude = Math.hypot(keyX, keyY);
    const touchMagnitude = Math.hypot(this.sticks.moveX, this.sticks.moveY);
    const gamepadMagnitude = Math.hypot(gamepadMoveX, gamepadMoveY);

    if (touchMagnitude >= keyboardMagnitude && touchMagnitude >= gamepadMagnitude) {
      this.actions.moveX = this.sticks.moveX;
      this.actions.moveY = this.sticks.moveY;
    } else if (gamepadMagnitude >= keyboardMagnitude) {
      this.actions.moveX = gamepadMoveX;
      this.actions.moveY = gamepadMoveY;
    } else {
      this.actions.moveX = clamp(keyX);
      this.actions.moveY = clamp(keyY);
    }

    this.actions.lookX += (gamepad?.axes[2] ?? 0) * 0.09;
    this.actions.lookY += (gamepad?.axes[3] ?? 0) * 0.075;
    this.actions.sprint = this.down("ShiftLeft") || this.down("ShiftRight") ||
      !!gamepad?.buttons[10]?.pressed || this.virtual.has("run");
    this.actions.crouch = this.down("ControlLeft") || this.down("ControlRight") ||
      !!gamepad?.buttons[1]?.pressed || this.virtual.has("crouch");
    this.actions.jump = this.pressed("Space") || !!gamepad?.buttons[0]?.pressed ||
      this.justPressed.has("jump");
    this.actions.roll = this.pressed("KeyQ") || !!gamepad?.buttons[3]?.pressed;
    this.actions.interact = this.pressed("KeyE") || !!gamepad?.buttons[2]?.pressed ||
      this.justPressed.has("interact");

    return this.actions;
  }

  endFrame() {
    this.justPressed.clear();
    this.actions.lookX = 0;
    this.actions.lookY = 0;
  }

  reset() {
    this.keys.clear();
    this.justPressed.clear();
    this.virtual.clear();
    this.pointers.clear();
    this.activeStick.move = null;
    this.activeStick.look = null;
    this.sticks.moveX = 0;
    this.sticks.moveY = 0;
    Object.assign(this.actions, {
      moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      sprint: false, jump: false, crouch: false, roll: false, interact: false
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.reset();
    this.canvas = null;
  }

  private bindStick(selector: string, kind: StickKind) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    element.style.touchAction = "none";

    const down = (event: PointerEvent) => {
      if (this.activeStick[kind] !== null) return;
      event.preventDefault();
      this.activeStick[kind] = event.pointerId;
      this.pointers.set(event.pointerId, { kind, x: event.clientX, y: event.clientY });
      element.classList.add("active");
      element.setPointerCapture?.(event.pointerId);
    };

    const move = (event: PointerEvent) => {
      const point = this.pointers.get(event.pointerId);
      if (!point || this.activeStick[point.kind] !== event.pointerId) return;
      event.preventDefault();
      const radius = Math.max(44, Math.min(element.clientWidth, element.clientHeight) * 0.42);
      const dx = event.clientX - point.x;
      const dy = event.clientY - point.y;

      if (kind === "move") {
        this.sticks.moveX = deadzone(clamp(dx / radius));
        this.sticks.moveY = deadzone(clamp(-dy / radius));
      } else {
        this.actions.lookX += clamp(dx * 0.0020, -0.12, 0.12);
        this.actions.lookY += clamp(dy * 0.0017, -0.10, 0.10);
        point.x = event.clientX;
        point.y = event.clientY;
      }

      element.style.setProperty("--sx", String(clamp(dx / radius)));
      element.style.setProperty("--sy", String(clamp(dy / radius)));
    };

    const end = (event: PointerEvent) => {
      if (!this.pointers.delete(event.pointerId)) return;
      this.activeStick[kind] = null;
      element.classList.remove("active");
      element.style.setProperty("--sx", "0");
      element.style.setProperty("--sy", "0");
      if (kind === "move") {
        this.sticks.moveX = 0;
        this.sticks.moveY = 0;
      }
    };

    element.addEventListener("pointerdown", down, { passive: false });
    element.addEventListener("pointermove", move, { passive: false });
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    element.addEventListener("lostpointercapture", end);
    this.cleanups.push(() => element.removeEventListener("pointerdown", down));
    this.cleanups.push(() => element.removeEventListener("pointermove", move));
    this.cleanups.push(() => element.removeEventListener("pointerup", end));
    this.cleanups.push(() => element.removeEventListener("pointercancel", end));
    this.cleanups.push(() => element.removeEventListener("lostpointercapture", end));
  }

  private down(code: string) {
    return this.keys.has(code);
  }

  private pressed(code: string) {
    return this.justPressed.has(code);
  }
}
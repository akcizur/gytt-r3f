import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, Physics, RigidBody } from "@react-three/rapier";
import type { GameBridge } from "../core/gameBridge";
import { InputSystem } from "../input/InputSystem";
import { Environment } from "../world/Environment";
import { PlayerVisual } from "../player/PlayerVisual";
import type { PlayerAnimationState } from "../player/PlayerAnimationSystem";

const MOVE_SPEED = 3.6;
const SPRINT_SPEED = 6.2;
const CROUCH_SPEED = 1.8;
const JUMP_SPEED = 7.2;

const CAMERA_DISTANCE = 6.5;
const CAMERA_MIN_Y = 0.25;
const CAMERA_PITCH_MIN = -0.82;
const CAMERA_PITCH_MAX = 0.68;

export function GameRuntime({ bridge, paused }: { bridge: GameBridge; paused: boolean }) {
  return (
    <Physics
      paused={paused}
      gravity={[0, -18, 0]}
      timeStep={1 / 60}
      interpolate={false}
    >
      <Environment />
      <PlayerController bridge={bridge} paused={paused} />
    </Physics>
  );
}

function PlayerController({ bridge, paused }: { bridge: GameBridge; paused: boolean }) {
  const bodyRef = useRef<any>(null);
  const visualRef = useRef<THREE.Group>(null);
  const input = useMemo(() => new InputSystem(), []);
  const { camera, gl } = useThree();

  const yawRef = useRef(0);
  // Positive pitch = camera moves above the target and looks downward.
  // Negative pitch = camera moves below the target and looks upward.
  const pitchRef = useRef(0.16);
  const characterYaw = useRef(0);
  const animationStateRef = useRef<PlayerAnimationState>("idle");
  const fpsRef = useRef({ time: performance.now(), frames: 0, fps: 0 });

  useEffect(() => {
    input.attach(gl.domElement);
    return () => input.dispose();
  }, [gl.domElement, input]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) return;

    if (paused) {
      input.endFrame();
      return;
    }

    const actions = input.sample();
    // Screen-space convention: moving the look input right turns the camera right.
    // With Three.js Y rotation and a third-person orbit behind the player, this is -yaw.
    yawRef.current -= actions.lookX;
    pitchRef.current = THREE.MathUtils.clamp(
      pitchRef.current + actions.lookY,
      CAMERA_PITCH_MIN,
      CAMERA_PITCH_MAX,
    );

    // Three.js world: +Y up, camera/player forward = -Z, +X = right.
    // Movement is camera-relative, so W follows camera forward and D follows camera right.
    const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));
    const direction = new THREE.Vector3()
      .addScaledVector(forward, actions.moveY)
      .addScaledVector(right, actions.moveX);

    const magnitude = Math.min(1, direction.length());
    if (magnitude > 0) direction.normalize();

    const speed = actions.crouch
      ? CROUCH_SPEED
      : actions.sprint
        ? SPRINT_SPEED
        : MOVE_SPEED;

    const velocity = body.linvel();
    const position = body.translation();
    const grounded = position.y <= 0.045 && velocity.y <= 0.45;
    const horizontal = direction.multiplyScalar(speed * magnitude);

    if (actions.jump && grounded && !actions.crouch) {
      body.setLinvel({ x: horizontal.x, y: JUMP_SPEED, z: horizontal.z }, true);
    } else {
      body.setLinvel({ x: horizontal.x, y: velocity.y, z: horizontal.z }, true);
    }

    if (visualRef.current) {
      visualRef.current.position.y = actions.crouch ? -0.12 : 0;
      if (magnitude > 0.05) {
        // Player visual forward is local -Z, therefore +X world direction is -90deg.
        const desiredYaw = Math.atan2(-direction.x, -direction.z);
        let deltaYaw = desiredYaw - characterYaw.current;
        deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
        characterYaw.current += deltaYaw * (1 - Math.exp(-14 * delta));
        visualRef.current.rotation.y = characterYaw.current;
      }
    }

    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    const playerState: PlayerAnimationState =
      !grounded
        ? velocity.y > 0.5 ? "jump" : "fall"
        : actions.crouch
          ? "crouch"
          : magnitude < 0.08
            ? "idle"
            : magnitude < 0.42
              ? "walk"
              : magnitude < 0.78
                ? "jog"
                : "run";

    animationStateRef.current = playerState;

    const target = new THREE.Vector3(position.x, position.y + 1.15, position.z);
    const cp = Math.cos(pitchRef.current);
    const sp = Math.sin(pitchRef.current);

    // Standard third-person orbit:
    // +Y = up, -Z = forward, positive pitch raises the camera.
    const desiredCamera = new THREE.Vector3(
      target.x + Math.sin(yawRef.current) * cp * CAMERA_DISTANCE,
      Math.max(
        CAMERA_MIN_Y,
        target.y + sp * CAMERA_DISTANCE,
      ),
      target.z + Math.cos(yawRef.current) * cp * CAMERA_DISTANCE,
    );

    camera.position.lerp(
      desiredCamera,
      1 - Math.pow(0.0008, Math.min(delta, 0.1)),
    );

    // Never allow the actual interpolated camera position to cross the ground plane.
    camera.position.y = Math.max(CAMERA_MIN_Y, camera.position.y);
    camera.lookAt(target);

    const fps = fpsRef.current;
    fps.frames += 1;
    const now = performance.now();
    if (now - fps.time >= 500) {
      fps.fps = Math.round((fps.frames * 1000) / (now - fps.time));
      fps.frames = 0;
      fps.time = now;
    }

    bridge.publishPlayer(
      {
        state: playerState,
        speed: horizontalSpeed,
        grounded,
        position: { x: position.x, y: position.y, z: position.z },
        yaw: characterYaw.current
      },
      fps.fps,
    );

    input.endFrame();
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      position={[0, 0, 8]}
      colliders={false}
      canSleep={false}
      linearDamping={0.35}
      angularDamping={12}
      enabledRotations={[false, false, false]}
      ccd
      userData={{ kind: "player" }}
    >
      <CapsuleCollider args={[0.68, 0.38]} position={[0, 1.06, 0]} friction={0.1} />
      <PlayerVisual ref={visualRef} paused={paused} animationStateRef={animationStateRef} />
    </RigidBody>
  );
}
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  CapsuleCollider,
  Physics,
  RapierRigidBody,
  RigidBody,
  useRapier,
} from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import type { GameBridge } from "../core/gameBridge";
import { InputSystem } from "../input/InputSystem";
import { Environment } from "../world/Environment";
import { PlayerVisual } from "../player/PlayerVisual";

const MOVE_SPEED = 3.6;
const SPRINT_SPEED = 6.2;
const CROUCH_SPEED = 1.8;
const JUMP_SPEED = 7.2;

const MOVE_ACCEL = 18;
const SPRINT_ACCEL = 24;
const CROUCH_ACCEL = 13;
const STOP_DECEL = 22;

const CAMERA_DISTANCE = 6.5;
const CAMERA_MIN_DISTANCE = 0.5;
const CAMERA_COLLISION_BUFFER = 0.24;
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
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const input = useMemo(() => new InputSystem(), []);
  const { camera, gl } = useThree();
  const { rapier, world } = useRapier();

  const yawRef = useRef(0);
  // Positive pitch = camera moves above the target and looks downward.
  // Negative pitch = camera moves below the target and looks upward.
  const pitchRef = useRef(0.16);
  const cameraDistanceRef = useRef(CAMERA_DISTANCE);
  const characterYaw = useRef(0);
  const fpsRef = useRef({ time: performance.now(), frames: 0, fps: 0 });

  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const cameraOrbit = useMemo(() => new THREE.Vector3(), []);
  const cameraDirection = useMemo(() => new THREE.Vector3(), []);
  const desiredCamera = useMemo(() => new THREE.Vector3(), []);

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

    const dt = Math.min(delta, 0.05);
    const actions = input.sample();

    // Screen-space convention: moving the look input right turns the camera right.
    // With Three.js Y rotation and a third-person orbit behind the player, this is -yaw.
    yawRef.current -= actions.lookX;
    pitchRef.current = THREE.MathUtils.clamp(
      pitchRef.current + actions.lookY,
      CAMERA_PITCH_MIN,
      CAMERA_PITCH_MAX,
    );

    // Three.js world: +Y up, -Z forward, +X right.
    // Movement remains camera-relative: W follows camera forward and D follows camera right.
    const forward = new THREE.Vector3(
      -Math.sin(yawRef.current),
      0,
      -Math.cos(yawRef.current),
    );
    const right = new THREE.Vector3(
      Math.cos(yawRef.current),
      0,
      -Math.sin(yawRef.current),
    );

    const direction = new THREE.Vector3()
      .addScaledVector(forward, actions.moveY)
      .addScaledVector(right, actions.moveX);

    const magnitude = Math.min(1, direction.length());
    if (magnitude > 0.001) direction.normalize();

    const speed = actions.crouch
      ? CROUCH_SPEED
      : actions.sprint
        ? SPRINT_SPEED
        : MOVE_SPEED;

    const velocity = body.linvel();
    const position = body.translation();
    const grounded = position.y <= 0.045 && velocity.y <= 0.45;

    const targetX = direction.x * speed * magnitude;
    const targetZ = direction.z * speed * magnitude;
    const acceleration = actions.crouch
      ? CROUCH_ACCEL
      : actions.sprint
        ? SPRINT_ACCEL
        : MOVE_ACCEL;

    const horizontalStep = acceleration * dt;
    const decelStep = STOP_DECEL * dt;
    const nextX = magnitude > 0.01
      ? approach(velocity.x, targetX, horizontalStep)
      : approach(velocity.x, 0, decelStep);
    const nextZ = magnitude > 0.01
      ? approach(velocity.z, targetZ, horizontalStep)
      : approach(velocity.z, 0, decelStep);

    const horizontalSpeed = Math.hypot(nextX, nextZ);

    if (actions.jump && grounded && !actions.crouch) {
      body.setLinvel({ x: nextX, y: JUMP_SPEED, z: nextZ }, true);
    } else {
      body.setLinvel({ x: nextX, y: velocity.y, z: nextZ }, true);
    }

    if (visualRef.current) {
      visualRef.current.position.y = THREE.MathUtils.damp(
        visualRef.current.position.y,
        actions.crouch ? -0.12 : 0,
        18,
        dt,
      );

      if (magnitude > 0.05) {
        // Player visual forward is local -Z.
        const desiredYaw = Math.atan2(-direction.x, -direction.z);
        let deltaYaw = desiredYaw - characterYaw.current;
        deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
        characterYaw.current += deltaYaw * (1 - Math.exp(-14 * dt));
        visualRef.current.rotation.y = characterYaw.current;
      }
    }

    const playerState =
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

    // Spring-arm camera target.
    cameraTarget.set(position.x, position.y + 1.15, position.z);

    const cp = Math.cos(pitchRef.current);
    const sp = Math.sin(pitchRef.current);

    cameraOrbit.set(
      Math.sin(yawRef.current) * cp,
      sp,
      Math.cos(yawRef.current) * cp,
    );
    cameraDirection.copy(cameraOrbit).normalize();

    // Rapier raycast makes the camera retract before it can enter walls,
    // while the rigid body filter guarantees the player's own capsule is ignored.
    const cameraRay = new rapier.Ray(
      {
        x: cameraTarget.x,
        y: cameraTarget.y,
        z: cameraTarget.z,
      },
      {
        x: cameraDirection.x,
        y: cameraDirection.y,
        z: cameraDirection.z,
      },
    );

    const cameraHit = world.castRay(
      cameraRay,
      CAMERA_DISTANCE,
      true,
      undefined,
      undefined,
      undefined,
      body,
    );

    const safeDistance = cameraHit
      ? Math.max(CAMERA_MIN_DISTANCE, cameraHit.toi - CAMERA_COLLISION_BUFFER)
      : CAMERA_DISTANCE;

    cameraDistanceRef.current = THREE.MathUtils.damp(
      cameraDistanceRef.current,
      safeDistance,
      cameraHit ? 22 : 8,
      dt,
    );

    desiredCamera.set(
      cameraTarget.x + cameraDirection.x * cameraDistanceRef.current,
      Math.max(
        CAMERA_MIN_Y,
        cameraTarget.y + cameraDirection.y * cameraDistanceRef.current,
      ),
      cameraTarget.z + cameraDirection.z * cameraDistanceRef.current,
    );

    camera.position.lerp(
      desiredCamera,
      1 - Math.pow(0.0008, Math.min(dt, 0.1)),
    );

    // Hard invariant: the render camera can never cross the ground plane.
    camera.position.y = Math.max(CAMERA_MIN_Y, camera.position.y);
    camera.lookAt(cameraTarget);

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
        yaw: characterYaw.current,
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
      <CapsuleCollider
        args={[0.68, 0.38]}
        position={[0, 1.06, 0]}
        friction={0.1}
      />
      <PlayerVisual ref={visualRef} paused={paused} />
    </RigidBody>
  );
}

function approach(current: number, target: number, amount: number) {
  if (current < target) return Math.min(current + amount, target);
  if (current > target) return Math.max(current - amount, target);
  return target;
}

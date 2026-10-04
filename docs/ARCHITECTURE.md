# GYTT R3F Architecture

This repository is the React Three Fiber remake of the original GYTT runtime.

## Boundaries

- React owns application and UI composition.
- R3F owns the Three.js scene graph and frame loop.
- Rapier is provided by @react-three/rapier.
- InputSystem remains framework-independent and outputs device-independent actions.
- GameBridge is the typed boundary between runtime and React HUD.
- PlayerVisual is visual-only; gameplay movement is owned by GameRuntime.
- Environment contains world visuals and static physics colliders.

## Runtime flow

Input -> GameRuntime/useFrame -> Rapier body -> PlayerVisual + Camera -> GameBridge -> HUD

## Preserved from GYTT

- third-person camera
- sprint, crouch and jump
- desktop, touch and gamepad input
- house and shed showcase world
- procedural fallback character
- static GitHub Pages deployment
- typed event boundary

## R3F migration

The imperative Game and RenderSystem loop from the original runtime is replaced by declarative R3F components. React does not own per-frame physics calculations; useFrame and Rapier do.

## Coordinate and input contract

The runtime uses the conventional Three.js/game coordinate contract:

- +Y = up
- -Z = forward
- +X = right
- MOVE_X +1 = right
- MOVE_Y +1 = forward
- LOOK_X +1 = turn camera right
- LOOK_Y +1 = look up

Keyboard, mouse, touch and gamepad inputs are normalized into that semantic contract before gameplay consumes them. Character heading uses local -Z as visual forward. Movement is camera-relative, so W follows the current camera heading and D moves to the camera's right.

Camera orbit uses the same yaw/pitch convention as the normalized look actions; the player model follows its actual movement vector rather than using a separate mirrored axis.


## Camera floor invariant

The third-person camera is orbit-based around the player target. The camera world-space Y is clamped to CAMERA_MIN_Y after interpolation, so smoothing can never move the actual camera below the ground plane at Y = 0.

## Camera collision model

The camera is implemented as a third-person spring arm:

- the orbit direction is computed from the normalized yaw/pitch contract;
- a Rapier ray is cast from the player target to the requested camera distance;
- the player's own rigid body is excluded from that query;
- on obstruction, the boom retracts with a fast damping response;
- when the path is clear, the boom returns with slower damping for stable framing;
- the final camera Y is hard-clamped above CAMERA_MIN_Y, so smoothing cannot place the render camera below the world ground plane.

This prevents the common third-person failure modes of wall penetration, camera snapping and ground-plane crossover.

## Player visual pipeline

The player uses the rigged asset stored in src/player. The GLTF and BIN are treated as Vite assets through import.meta.url, while the GLTF loader redirects its external BIN URI to the emitted asset URL. The source asset currently contains a rig but no animation clips, so the R3F runtime applies a lightweight procedural gait to the main leg, arm and spine bones.
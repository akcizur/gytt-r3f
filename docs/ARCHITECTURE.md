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
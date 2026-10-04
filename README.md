# GYTT R3F

React Three Fiber remake of GYTT.

## Stack

React 19, React Three Fiber 9, Three.js, Rapier 2 and Vite.

## Runtime

The remake preserves the original GYTT direction: browser-native third-person open-world action gameplay, mobile-first input, Rapier physics, a house and shed showcase environment, and a procedural character fallback.

Gameplay runs in useFrame; React handles composition and HUD state through GameBridge.

## Development

Run:

npm install
npm run dev
npm run typecheck
npm run build

GitHub Pages target:

https://akcizur.github.io/gytt-r3f/

## Controls

- W A S D move
- Shift sprint
- Space jump
- Ctrl crouch
- E interact
- mouse or right stick look
- touch controls appear automatically on coarse pointers

See docs/ARCHITECTURE.md for the migration boundary from the original GYTT runtime.
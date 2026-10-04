import { forwardRef, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export const PlayerVisual = forwardRef<THREE.Group, { paused: boolean }>(
  function PlayerVisual({ paused }, forwardedRef) {
    const leftLeg = useRef<THREE.Mesh>(null);
    const rightLeg = useRef<THREE.Mesh>(null);
    const leftArm = useRef<THREE.Mesh>(null);
    const rightArm = useRef<THREE.Mesh>(null);
    const head = useRef<THREE.Mesh>(null);
    const phase = useRef(0);

    useFrame((state, delta) => {
      if (paused) return;
      phase.current += delta * 9;
      const stride = Math.sin(phase.current) * 0.5;
      const breathe = Math.sin(state.clock.elapsedTime * 2.1) * 0.015;

      if (leftLeg.current) leftLeg.current.rotation.x = stride;
      if (rightLeg.current) rightLeg.current.rotation.x = -stride;
      if (leftArm.current) leftArm.current.rotation.x = -stride * 0.65;
      if (rightArm.current) rightArm.current.rotation.x = stride * 0.65;
      if (head.current) head.current.position.y = 1.63 + breathe;
    });

    return (
      <group ref={forwardedRef}>
        <mesh position={[0, 0.98, 0]} castShadow>
          <capsuleGeometry args={[0.28, 0.65, 5, 10]} />
          <meshStandardMaterial color="#3d73b8" roughness={0.8} />
        </mesh>
        <mesh ref={head} position={[0, 1.63, 0]} castShadow>
          <sphereGeometry args={[0.28, 16, 12]} />
          <meshStandardMaterial color="#79a1cf" roughness={0.75} />
        </mesh>
        <mesh position={[0, 1.64, -0.275]} castShadow>
          <boxGeometry args={[0.32, 0.08, 0.025]} />
          <meshStandardMaterial color="#17202a" roughness={0.9} />
        </mesh>
        <mesh ref={leftArm} position={[-0.39, 1.03, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.55, 4, 8]} />
          <meshStandardMaterial color="#2f5b8e" roughness={0.82} />
        </mesh>
        <mesh ref={rightArm} position={[0.39, 1.03, 0]} castShadow>
          <capsuleGeometry args={[0.1, 0.55, 4, 8]} />
          <meshStandardMaterial color="#2f5b8e" roughness={0.82} />
        </mesh>
        <mesh ref={leftLeg} position={[-0.16, 0.44, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.62, 4, 8]} />
          <meshStandardMaterial color="#17202a" roughness={0.92} />
        </mesh>
        <mesh ref={rightLeg} position={[0.16, 0.44, 0]} castShadow>
          <capsuleGeometry args={[0.11, 0.62, 4, 8]} />
          <meshStandardMaterial color="#17202a" roughness={0.92} />
        </mesh>
      </group>
    );
  },
);
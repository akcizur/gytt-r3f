import { CuboidCollider, RigidBody } from "@react-three/rapier";

const vegetation = [
  [-15, -8, 1.1],
  [17, -12, 1.25],
  [-18, 5, 0.9],
  [18, 8, 1.15],
  [-11, 15, 1],
  [8, 16, 0.85],
  [22, 0, 0.75],
  [-24, -2, 0.8]
] as const;

export function Environment() {
  return (
    <>
      <color attach="background" args={["#8faabd"]} />
      <fog attach="fog" args={["#8faabd", 45, 240]} />
      <hemisphereLight args={["#cfe5ff", "#253029", 1.2]} />
      <directionalLight
        castShadow
        intensity={2.2}
        position={[40, 70, 25]}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
      />

      <Ground />
      <House />
      <Shed />
      <Road />

      {vegetation.map(([x, z, scale], index) => (
        <Tree key={index} position={[x, 0, z]} scale={scale} />
      ))}
    </>
  );
}

function Ground() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#66715f" roughness={1} />
      </mesh>
      <CuboidCollider args={[70, 0.05, 70]} position={[0, -0.05, 0]} />
    </RigidBody>
  );
}

function Road() {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, 0.012, 31]}>
      <planeGeometry args={[8, 48]} />
      <meshStandardMaterial color="#77736a" roughness={0.95} />
    </mesh>
  );
}

function House() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <group position={[0, 0, -5]}>
        <mesh position={[0, 2.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[13, 5.4, 9]} />
          <meshStandardMaterial color="#d7d0c2" roughness={0.9} />
        </mesh>
        <mesh position={[0, 6.9, 0]} rotation-y={Math.PI / 4} scale-z={0.7} castShadow>
          <coneGeometry args={[7.9, 3.2, 4]} />
          <meshStandardMaterial color="#3d3833" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.16, 5.2]} castShadow>
          <boxGeometry args={[7, 0.3, 2.2]} />
          <meshStandardMaterial color="#5d4636" roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.35, 4.56]} castShadow>
          <boxGeometry args={[1.35, 2.7, 0.16]} />
          <meshStandardMaterial color="#5d4636" roughness={0.85} />
        </mesh>
        {[-4.2, 4.2].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.8, 4.56]}>
              <boxGeometry args={[2.35, 1.55, 0.16]} />
              <meshStandardMaterial color="#607b82" roughness={0.2} metalness={0.05} />
            </mesh>
            <mesh position={[x, 2.8, 4.45]}>
              <boxGeometry args={[0.08, 1.7, 0.2]} />
              <meshStandardMaterial color="#b7afa0" roughness={0.95} />
            </mesh>
            <mesh position={[x, 2.8, 4.45]}>
              <boxGeometry args={[2.5, 0.08, 0.2]} />
              <meshStandardMaterial color="#b7afa0" roughness={0.95} />
            </mesh>
          </group>
        ))}
        <mesh position={[3.5, 7.2, -1.8]} castShadow>
          <boxGeometry args={[0.9, 2.2, 0.9]} />
          <meshStandardMaterial color="#b7afa0" roughness={0.95} />
        </mesh>
      </group>
      <CuboidCollider args={[6.5, 2.7, 4.5]} position={[0, 2.7, -5]} />
    </RigidBody>
  );
}

function Shed() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <group position={[11, 0, -2]}>
        <mesh position={[0, 1.7, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.5, 3.4, 4.5]} />
          <meshStandardMaterial color="#76614f" roughness={0.95} />
        </mesh>
        <mesh position={[0, 3.55, 0]} castShadow>
          <boxGeometry args={[6.1, 0.35, 5.1]} />
          <meshStandardMaterial color="#393733" roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.35, 2.3]} castShadow>
          <boxGeometry args={[1.7, 2.7, 0.12]} />
          <meshStandardMaterial color="#443b33" roughness={0.9} />
        </mesh>
      </group>
      <CuboidCollider args={[2.75, 1.7, 2.25]} position={[11, 1.7, -2]} />
    </RigidBody>
  );
}

function Tree({
  position,
  scale
}: {
  position: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.22, 2.5, 8]} />
        <meshStandardMaterial color="#584536" roughness={1} />
      </mesh>
      <mesh position={[0, 3.1, 0]} castShadow>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color="#435844" roughness={1} />
      </mesh>
    </group>
  );
}
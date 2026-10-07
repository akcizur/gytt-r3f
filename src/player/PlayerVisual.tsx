import { forwardRef, useEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  createPlayerAnimationClips,
  PlayerAnimationController,
  type PlayerAnimationState,
} from "./PlayerAnimationSystem";

const PLAYER_HEIGHT_METERS = 1.8;
const MODEL_URL = `${import.meta.env.BASE_URL}player/mannequin/scene.gltf`;

type Props = {
  paused: boolean;
  animationStateRef: RefObject<PlayerAnimationState>;
};

export const PlayerVisual = forwardRef<THREE.Group, Props>(function PlayerVisual(
  { paused, animationStateRef },
  forwardedRef,
) {
  const groupRef = useRef<THREE.Group>(null);
  const fallbackRef = useRef<THREE.Group>(null);
  const animationRef = useRef<PlayerAnimationController | null>(null);

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed || !groupRef.current) return;

        const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;

        // Source asset is Z-up. The runtime is Y-up.
        model.rotation.x = Math.PI / 2;
        model.updateMatrixWorld(true);

        let bounds = new THREE.Box3().setFromObject(model);
        const height = Math.max(0.001, bounds.max.y - bounds.min.y);
        model.scale.setScalar(PLAYER_HEIGHT_METERS / height);
        model.updateMatrixWorld(true);

        // Exact floor anchor: lowest visible point is Y=0.
        bounds = new THREE.Box3().setFromObject(model);
        model.position.y -= bounds.min.y;
        model.updateMatrixWorld(true);

        model.traverse((object) => {
          if (!(object as THREE.Mesh).isMesh) return;

          const mesh = object as THREE.Mesh;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.frustumCulled = true;

          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of materials) {
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            material.metalness = Math.max(material.metalness, 0.72);
            material.roughness = Math.min(material.roughness, 0.34);
          }
        });

        animationRef.current?.dispose();
        animationRef.current = new PlayerAnimationController(
          model,
          createPlayerAnimationClips(model),
        );

        groupRef.current.clear();
        groupRef.current.add(model);

        if (fallbackRef.current) fallbackRef.current.visible = false;
      },
      undefined,
      () => {
        if (fallbackRef.current) fallbackRef.current.visible = true;
      },
    );

    return () => {
      disposed = true;
      animationRef.current?.dispose();
      animationRef.current = null;
    };
  }, []);

  useFrame((_, delta) => {
    if (paused || !animationRef.current) return;

    animationRef.current.play(animationStateRef.current);
    animationRef.current.update(delta);
  });

  const setGroupRef = (node: THREE.Group | null) => {
    groupRef.current = node;

    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  return (
    <>
      <group ref={setGroupRef} />
      <group ref={fallbackRef} visible>
        <mesh position={[0, 0.48, 0]} castShadow>
          <capsuleGeometry args={[0.22, 0.52, 8, 16]} />
          <meshStandardMaterial color="#0b6f94" metalness={0.8} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0.98, 0]} castShadow>
          <sphereGeometry args={[0.22, 20, 14]} />
          <meshStandardMaterial color="#0b6f94" metalness={0.8} roughness={0.28} />
        </mesh>
        <mesh position={[-0.15, 0.23, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.34, 8, 12]} />
          <meshStandardMaterial color="#0b6f94" metalness={0.78} roughness={0.3} />
        </mesh>
        <mesh position={[0.15, 0.23, 0]} castShadow>
          <capsuleGeometry args={[0.08, 0.34, 8, 12]} />
          <meshStandardMaterial color="#0b6f94" metalness={0.78} roughness={0.3} />
        </mesh>
        <mesh position={[-0.38, 0.55, 0]} rotation-z={-0.16} castShadow>
          <capsuleGeometry args={[0.07, 0.38, 8, 12]} />
          <meshStandardMaterial color="#0b6f94" metalness={0.78} roughness={0.3} />
        </mesh>
        <mesh position={[0.38, 0.55, 0]} rotation-z={0.16} castShadow>
          <capsuleGeometry args={[0.07, 0.38, 8, 12]} />
          <meshStandardMaterial color="#0b6f94" metalness={0.78} roughness={0.3} />
        </mesh>
      </group>
    </>
  );
});

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
  const animationRef = useRef<PlayerAnimationController | null>(null);

  useEffect(() => {
    let disposed = false;
    const loader = new GLTFLoader();

    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed || !groupRef.current) return;

        const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;

        // The supplied mannequin is Z-up. Convert the model to the engine's Y-up convention.
        model.rotation.x = Math.PI / 2;
        model.updateMatrixWorld(true);

        let bounds = new THREE.Box3().setFromObject(model);
        const height = Math.max(0.001, bounds.max.y - bounds.min.y);

        // Normalize to an adult human height of exactly 1.80 m.
        model.scale.setScalar(PLAYER_HEIGHT_METERS / height);
        model.updateMatrixWorld(true);

        // Feet are the authoritative ground anchor. No floating and no sinking.
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
      },
      undefined,
      () => {
        animationRef.current?.dispose();
        animationRef.current = null;
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

  return <group ref={setGroupRef} />;
});

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

const MODEL_URL = new URL("./Rigged character.gltf", import.meta.url).href;
const BIN_URL = new URL("./Rigged character.bin", import.meta.url).href;

type Props = {
  paused: boolean;
  animationStateRef: RefObject<PlayerAnimationState>;
};

export const PlayerVisual = forwardRef<THREE.Group, Props>(
  function PlayerVisual({ paused, animationStateRef }, forwardedRef) {
    const groupRef = useRef<THREE.Group>(null);
    const modelRef = useRef<THREE.Group | null>(null);
    const animationRef = useRef<PlayerAnimationController | null>(null);

    useEffect(() => {
      let cancelled = false;

      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        if (
          url.endsWith("Rigged%20character.bin") ||
          url.endsWith("Rigged character.bin")
        ) {
          return BIN_URL;
        }
        return url;
      });

      const loader = new GLTFLoader(manager);

      loader.load(
        MODEL_URL,
        (gltf) => {
          if (cancelled) return;

          const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;
          const bounds = new THREE.Box3().setFromObject(model);
          const size = bounds.getSize(new THREE.Vector3());

          if (size.y > 0.001) {
            model.scale.multiplyScalar(1.85 / size.y);
          }

          const normalizedBounds = new THREE.Box3().setFromObject(model);
          model.position.y -= normalizedBounds.min.y;
          model.rotation.y = Math.PI;

          model.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = true;
          });

          animationRef.current?.dispose();

          const clips = createPlayerAnimationClips(model);
          animationRef.current = new PlayerAnimationController(model, clips);
          modelRef.current = model;

          if (groupRef.current) {
            groupRef.current.clear();
            groupRef.current.add(model);
          }
        },
        undefined,
        () => {
          modelRef.current = null;
          animationRef.current?.dispose();
          animationRef.current = null;
        },
      );

      return () => {
        cancelled = true;
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
  },
);

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

const MODEL_URL = new URL("./Rigged character.gltf", import.meta.url).href;
const BIN_URL = new URL("./Rigged character.bin", import.meta.url).href;

type LoadedPlayer = {
  model: THREE.Object3D;
};

export const PlayerVisual = forwardRef<THREE.Group, { paused: boolean }>(
  function PlayerVisual({ paused }, forwardedRef) {
    const groupRef = useRef<THREE.Group>(null);
    const lastParentPosition = useRef(new THREE.Vector3());
    const initializedParentPosition = useRef(false);
    const phase = useRef(0);
    const [loadedPlayer, setLoadedPlayer] = useState<LoadedPlayer | null>(null);

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

      loader
        .loadAsync(MODEL_URL)
        .then((gltf) => {
          if (cancelled) return;

          const root = SkeletonUtils.clone(gltf.scene);
          const bounds = new THREE.Box3().setFromObject(root);
          const size = bounds.getSize(new THREE.Vector3());

          if (size.y > 0.001) {
            root.scale.multiplyScalar(1.85 / size.y);
          }

          const normalizedBounds = new THREE.Box3().setFromObject(root);
          root.position.y -= normalizedBounds.min.y;
          root.rotation.y = Math.PI;

          root.traverse((object) => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.frustumCulled = true;
          });

          setLoadedPlayer({ model: root });
        })
        .catch(() => {
          // The procedural character below is intentionally kept as a runtime fallback.
          if (!cancelled) setLoadedPlayer(null);
        });

      return () => {
        cancelled = true;
      };
    }, []);

    const rig = useMemo(() => {
      if (!loadedPlayer) return [];

      const model = loadedPlayer.model;
      const boneNames = [
        "Root",
        "spine",
        "spine.001",
        "upper_arm.L",
        "upper_arm.R",
        "thigh.L",
        "thigh.R",
      ];

      return boneNames
        .map((name) => {
          const bone = model.getObjectByName(name);
          return bone
            ? {
                name,
                bone,
                rest: bone.quaternion.clone(),
              }
            : null;
        })
        .filter(
          (
            entry,
          ): entry is {
            name: string;
            bone: THREE.Object3D;
            rest: THREE.Quaternion;
          } => entry !== null,
        );
    }, [loadedPlayer]);

    const fallback = useMemo(() => createFallback(), []);

    useFrame((state, delta) => {
      if (paused || !groupRef.current) return;

      const parent = groupRef.current.parent;
      let worldSpeed = 0;

      if (parent) {
        const parentPosition = new THREE.Vector3();
        parent.getWorldPosition(parentPosition);

        if (initializedParentPosition.current && delta > 0) {
          worldSpeed = parentPosition.distanceTo(lastParentPosition.current) / delta;
        } else {
          initializedParentPosition.current = true;
        }

        lastParentPosition.current.copy(parentPosition);
      }

      const moving = worldSpeed > 0.12;
      const cadence = moving
        ? 5.2 + Math.min(worldSpeed, 7) * 0.95
        : 2.1;

      phase.current += delta * cadence;

      const stride = moving
        ? Math.sin(phase.current) * Math.min(0.45, worldSpeed * 0.075)
        : 0;
      const armSwing = stride * 0.7;
      const breath = Math.sin(state.clock.elapsedTime * 2.2) * 0.012;
      const bob = moving
        ? Math.abs(Math.sin(phase.current)) * Math.min(0.028, worldSpeed * 0.004)
        : 0;

      if (loadedPlayer) {
        loadedPlayer.model.position.y = breath + bob;

        for (const entry of rig) {
          let offset = 0;

          if (entry.name === "thigh.L") offset = stride;
          if (entry.name === "thigh.R") offset = -stride;
          if (entry.name === "upper_arm.L") offset = -armSwing;
          if (entry.name === "upper_arm.R") offset = armSwing;
          if (entry.name === "spine") offset = -stride * 0.08;
          if (entry.name === "spine.001") offset = stride * 0.05;
          if (entry.name === "Root") offset = stride * 0.04;

          if (offset === 0) {
            entry.bone.quaternion.copy(entry.rest);
            continue;
          }

          const rotation = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            offset,
          );
          entry.bone.quaternion.copy(entry.rest).multiply(rotation);
        }
      }

      animateFallback(fallback, moving, stride, breath, bob, state.clock.elapsedTime);
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
      <group ref={setGroupRef}>
        {loadedPlayer
          ? <primitive object={loadedPlayer.model} />
          : fallback.group}
      </group>
    );
  },
);

function createFallback() {
  const group = new THREE.Group();

  const material = new THREE.MeshStandardMaterial({
    color: "#3d73b8",
    roughness: 0.8,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#17202a",
    roughness: 0.9,
  });

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.28, 0.65, 5, 10),
    material,
  );
  torso.position.y = 0.98;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    material,
  );
  head.position.y = 1.63;

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.025),
    dark,
  );
  visor.position.set(0, 1.64, -0.275);

  const leftArm = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.1, 0.55, 4, 8),
    material,
  );
  const rightArm = leftArm.clone();
  leftArm.position.set(-0.39, 1.03, 0);
  rightArm.position.set(0.39, 1.03, 0);

  const leftLeg = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.11, 0.62, 4, 8),
    dark,
  );
  const rightLeg = leftLeg.clone();
  leftLeg.position.set(-0.16, 0.44, 0);
  rightLeg.position.set(0.16, 0.44, 0);

  const meshes = [
    torso,
    head,
    visor,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
  ];

  for (const mesh of meshes) {
    mesh.castShadow = true;
    group.add(mesh);
  }

  return {
    group,
    parts: {
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      head,
    },
  };
}

function animateFallback(
  fallback: ReturnType<typeof createFallback>,
  moving: boolean,
  stride: number,
  breath: number,
  bob: number,
  time: number,
) {
  const {
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
  } = fallback.parts;

  leftLeg.rotation.x = moving ? stride : 0;
  rightLeg.rotation.x = moving ? -stride : 0;
  leftArm.rotation.x = moving ? -stride * 0.65 : 0;
  rightArm.rotation.x = moving ? stride * 0.65 : 0;
  head.position.y = 1.63 + breath;
  fallback.group.position.y = bob;
}

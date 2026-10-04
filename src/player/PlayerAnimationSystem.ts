import * as THREE from "three";

export type PlayerAnimationState =
  | "idle"
  | "walk"
  | "jog"
  | "run"
  | "crouch"
  | "jump"
  | "fall";

type BoneRef = {
  bone: THREE.Object3D;
  rest: THREE.Quaternion;
};

const LOOP_TIMES = [0, 0.25, 0.5, 0.75, 1];

function makeQuaternionKeys(rest: THREE.Quaternion, angles: number[]) {
  const values: number[] = [];
  const axis = new THREE.Vector3(1, 0, 0);

  for (const angle of angles) {
    const rotation = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const q = rest.clone().multiply(rotation);
    values.push(q.x, q.y, q.z, q.w);
  }

  return values;
}

function addTrack(
  tracks: THREE.KeyframeTrack[],
  bone: BoneRef | undefined,
  amplitude: number,
  wave = [0, 1, 0, -1, 0],
) {
  if (!bone) return;

  tracks.push(
    new THREE.QuaternionKeyframeTrack(
      `${bone.bone.uuid}.quaternion`,
      LOOP_TIMES,
      makeQuaternionKeys(
        bone.rest,
        wave.map((value) => value * amplitude),
      ),
    ),
  );
}

function buildClip(
  state: PlayerAnimationState,
  duration: number,
  bones: Map<string, BoneRef>,
  config: {
    legs: number;
    arms: number;
    spine: number;
    root: number;
  },
) {
  const tracks: THREE.KeyframeTrack[] = [];

  addTrack(tracks, bones.get("thigh.L"), config.legs);
  addTrack(tracks, bones.get("thigh.R"), -config.legs);
  addTrack(tracks, bones.get("upper_arm.L"), -config.arms);
  addTrack(tracks, bones.get("upper_arm.R"), config.arms);
  addTrack(tracks, bones.get("spine"), -config.spine);
  addTrack(tracks, bones.get("spine.001"), config.spine * 0.6);
  addTrack(tracks, bones.get("Root"), config.root);

  return new THREE.AnimationClip(state, duration, tracks);
}

export function createPlayerAnimationClips(root: THREE.Object3D) {
  const boneNames = [
    "Root",
    "spine",
    "spine.001",
    "upper_arm.L",
    "upper_arm.R",
    "thigh.L",
    "thigh.R",
  ];

  const bones = new Map<string, BoneRef>();

  for (const name of boneNames) {
    const bone = root.getObjectByName(name);
    if (bone) {
      bones.set(name, {
        bone,
        rest: bone.quaternion.clone(),
      });
    }
  }

  return [
    buildClip("idle", 2.4, bones, {
      legs: 0.015,
      arms: 0.01,
      spine: 0.03,
      root: 0.008,
    }),
    buildClip("walk", 0.92, bones, {
      legs: 0.42,
      arms: 0.28,
      spine: 0.04,
      root: 0.018,
    }),
    buildClip("jog", 0.72, bones, {
      legs: 0.58,
      arms: 0.38,
      spine: 0.05,
      root: 0.024,
    }),
    buildClip("run", 0.54, bones, {
      legs: 0.76,
      arms: 0.5,
      spine: 0.06,
      root: 0.032,
    }),
    buildClip("crouch", 1.2, bones, {
      legs: 0.1,
      arms: 0.05,
      spine: 0.16,
      root: 0.07,
    }),
    buildClip("jump", 0.7, bones, {
      legs: 0.14,
      arms: 0.28,
      spine: 0.08,
      root: 0.16,
    }),
    buildClip("fall", 0.9, bones, {
      legs: 0.08,
      arms: 0.22,
      spine: 0.05,
      root: 0.08,
    }),
  ];
}

export class PlayerAnimationController {
  private readonly mixer: THREE.AnimationMixer;
  private readonly root: THREE.Object3D;
  private readonly actions = new Map<PlayerAnimationState, THREE.AnimationAction>();
  private current: PlayerAnimationState = "idle";

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);

    for (const clip of clips) {
      this.actions.set(
        clip.name as PlayerAnimationState,
        this.mixer.clipAction(clip),
      );
    }

    this.play("idle", true);
  }

  play(state: PlayerAnimationState, immediate = false) {
    const next = this.actions.get(state) ?? this.actions.get("idle");
    if (!next) return;

    const previous = this.actions.get(this.current);
    if (previous === next && !immediate) return;

    this.current = state;
    next.reset();
    next.setLoop(THREE.LoopRepeat, Infinity);

    if (previous && previous !== next) {
      previous.fadeOut(immediate ? 0 : 0.12);
    }

    next.fadeIn(immediate ? 0 : 0.12).play();
  }

  update(delta: number) {
    this.mixer.update(delta);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
  }
}

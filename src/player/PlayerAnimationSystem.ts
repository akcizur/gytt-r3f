import * as THREE from "three";

export type PlayerAnimationState =
  | "idle"
  | "walk"
  | "jog"
  | "run"
  | "crouch"
  | "jump"
  | "fall";

type Bone = {
  object: THREE.Object3D;
  rest: THREE.Quaternion;
};

const TIMES = [0, 0.25, 0.5, 0.75, 1];
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const AXIS_X = new THREE.Vector3(1, 0, 0);

function qKeys(rest: THREE.Quaternion, angles: number[], axis = AXIS_Z) {
  const out: number[] = [];
  for (const angle of angles) {
    const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const q = rest.clone().multiply(delta);
    out.push(q.x, q.y, q.z, q.w);
  }
  return out;
}

function addQuatTrack(
  tracks: THREE.KeyframeTrack[],
  bone: Bone | undefined,
  angles: number[],
  axis = AXIS_Z,
) {
  if (!bone) return;
  tracks.push(
    new THREE.QuaternionKeyframeTrack(
      `${bone.object.uuid}.quaternion`,
      TIMES,
      qKeys(bone.rest, angles, axis),
    ),
  );
}

function buildClip(
  name: PlayerAnimationState,
  duration: number,
  bones: Map<string, Bone>,
  cfg: {
    leg: number;
    knee: number;
    arm: number;
    elbow: number;
    spine: number;
  },
) {
  const tracks: THREE.KeyframeTrack[] = [];
  const legWave = [0, cfg.leg, 0, -cfg.leg, 0];
  const kneeWave = [cfg.knee * 0.15, cfg.knee, cfg.knee * 0.15, cfg.knee * 0.45, cfg.knee * 0.15];
  const armWave = [0, -cfg.arm, 0, cfg.arm, 0];
  const elbowWave = [cfg.elbow * 0.2, cfg.elbow, cfg.elbow * 0.2, cfg.elbow * 0.65, cfg.elbow * 0.2];
  const spineWave = [cfg.spine, 0, -cfg.spine, 0, cfg.spine];

  addQuatTrack(tracks, bones.get("thigh_l_048"), legWave);
  addQuatTrack(tracks, bones.get("thigh_r_054"), legWave.map((v) => -v));
  addQuatTrack(tracks, bones.get("calf_l_049"), kneeWave);
  addQuatTrack(tracks, bones.get("calf_r_055"), kneeWave.map((v) => -v));

  addQuatTrack(tracks, bones.get("upperarm_l_06"), armWave);
  addQuatTrack(tracks, bones.get("upperarm_r_027"), armWave.map((v) => -v));
  addQuatTrack(tracks, bones.get("lowerarm_l_07"), elbowWave);
  addQuatTrack(tracks, bones.get("lowerarm_r_028"), elbowWave.map((v) => -v));

  addQuatTrack(tracks, bones.get("spine_02_03"), spineWave, AXIS_X);
  addQuatTrack(tracks, bones.get("spine_03_04"), spineWave.map((v) => v * 0.6), AXIS_X);
  return new THREE.AnimationClip(name, duration, tracks);
}

export function createPlayerAnimationClips(root: THREE.Object3D) {
  const names = [
    "thigh_l_048", "thigh_r_054", "calf_l_049", "calf_r_055",
    "foot_l_051", "foot_r_057", "upperarm_l_06", "upperarm_r_027",
    "lowerarm_l_07", "lowerarm_r_028", "spine_02_03", "spine_03_04",
  ];
  const bones = new Map<string, Bone>();
  for (const name of names) {
    const object = root.getObjectByName(name);
    if (object) bones.set(name, { object, rest: object.quaternion.clone() });
  }

  return [
    buildClip("idle", 2.8, bones, {
      leg: 0.015, knee: 0.008, arm: 0.015, elbow: 0.008, spine: 0.018,
    }),
    buildClip("walk", 0.92, bones, {
      leg: 0.38, knee: 0.22, arm: 0.26, elbow: 0.14, spine: 0.032,
    }),
    buildClip("jog", 0.72, bones, {
      leg: 0.54, knee: 0.34, arm: 0.36, elbow: 0.20, spine: 0.045,
    }),
    buildClip("run", 0.54, bones, {
      leg: 0.72, knee: 0.50, arm: 0.48, elbow: 0.28, spine: 0.06,
    }),
    buildClip("crouch", 1.1, bones, {
      leg: 0.08, knee: -0.30, arm: 0.05, elbow: 0.08, spine: 0.20,
    }),
    buildClip("jump", 0.68, bones, {
      leg: 0.12, knee: -0.18, arm: -0.34, elbow: -0.14, spine: -0.08,
    }),
    buildClip("fall", 0.9, bones, {
      leg: 0.08, knee: 0.10, arm: 0.26, elbow: 0.12, spine: 0.04,
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
      this.actions.set(clip.name as PlayerAnimationState, this.mixer.clipAction(clip));
    }
    this.play("idle", true);
  }

  play(state: PlayerAnimationState, immediate = false) {
    const next = this.actions.get(state) ?? this.actions.get("idle");
    if (!next) return;

    const previous = this.actions.get(this.current);
    if (previous === next && !immediate) return;

    this.current = state;
    next.reset().setLoop(THREE.LoopRepeat, Infinity);
    if (previous && previous !== next) previous.fadeOut(immediate ? 0 : 0.12);
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

import { RecognizerOndevice } from "./Recognizer";

class Counter {
  constructor(readonly fps, readonly worker: RecognizerOndevice) {}

  forGood = Math.max((3 * Math.round(this.fps)) / 30, 1);
  nowPose = "star_up";
  counter = new Map();
  last = new Map();
  first = false;
  cntFrames = 0;

  updateForGood(fps) {
    this.forGood = Math.max((3 * Math.round(fps)) / 30, 1);
  }

  step(poseName) {
    if (this.worker.config == null) return null;

    if (poseName === this.nowPose) {
      this.cntFrames += 1;
    } else {
      this.nowPose = poseName || "";
      this.cntFrames = 1;
    }

    if (this.cntFrames >= this.forGood && this.nowPose !== null) {
      const parts = this.nowPose.split("_");
      const t = parts.pop();
      const pose = parts.join("_");

      if (this.last.get(pose) !== t) {
        this.last.set(pose, t);
        if (this.worker.config.keyMoment[pose] === t && this.first) return pose;
        this.first = true;
      }
    }

    return null;
  }
}

export default Counter;

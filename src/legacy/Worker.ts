import { loadStats, predictStats, uploadStats } from "../stats";
import { SkeletData } from "../types";

export enum WorkoutDisconnectStatus {
  AlreadyCompleted = 3002,
  AlreadyStarted = 3003,
  NoFreeWorkers = 3005,
  SuccessWorkout = 3006,
  Error = 0,
}

export interface WorkoutWorkerDelegate {
  onDidStart(worker: WorkoutWorker): void;
  onDidCompleteExercise(worker: WorkoutWorker): void;
  onDidDisconnect(worker: WorkoutWorker, status: WorkoutDisconnectStatus): void;
  onDidReplaceExercise(worker: WorkoutWorker, exercise: string, count: number, position: number): void;
  onDidNextExercise(worker: WorkoutWorker, exercise: string, count: number, position: number): void;
}

export class WorkoutWorker {
  private socket: WebSocket;
  private endpoint = "wss://dev.fora.vision";
  private isStarted = false;

  public delegate?: WorkoutWorkerDelegate;

  private totalLoad = 0;
  private totalUpload = 0;

  constructor(readonly workoutId: number) {
    this.socket = new WebSocket(`${this.endpoint}/api/v2/workout/ws/recognizer/${workoutId}`);

    this.socket.onopen = () => {
      this.isStarted = true;
      this.delegate?.onDidStart(this);
    };

    this.socket.onerror = (err) => {
      console.log(err);
      this.isStarted = false;
      this.delegate?.onDidDisconnect(this, WorkoutDisconnectStatus.Error);
    };

    this.socket.onclose = (err) => {
      console.log(err);
      this.isStarted = false;
      this.delegate?.onDidDisconnect(this, err.code);
    };

    this.socket.onmessage = (event) => {
      const size = new TextEncoder().encode(event.data).length;
      this.totalLoad += size / 1024;
      loadStats.update(this.totalLoad, this.totalLoad * 2);

      const action = JSON.parse(event.data);
      if (action.type === "NEW_REPEAT_FOUND") {
        this.delegate?.onDidCompleteExercise(this);
        predictStats.update(performance.now() - this.frames[action.frame_id], 200);
      }

      if (action.type === "NEXT_EXERCISE") {
        this.delegate?.onDidNextExercise(this, action.label, action.count, action.exercise_num);
      }

      if (action.type === "REPLACE_EXERCISE") {
        this.delegate?.onDidReplaceExercise(this, action.label, action.count, action.exercise_num);
      }
    };
  }

  replaceExercise() {
    if (!this.isStarted) return;

    const data = JSON.stringify({ type: "REPLACE_EXERCISE" });
    const size = new TextEncoder().encode(data).length;
    this.totalUpload += size / 1024;

    uploadStats.update(this.totalUpload, this.totalUpload * 2);
    this.socket.send(data);
  }

  private frames: Record<number, number> = {};
  sendFrame(points: SkeletData, width: number, height: number, id: number) {
    if (!this.isStarted) return;

    const data = JSON.stringify({
      type: "FRAME",
      data: points,
      width,
      height,
    });

    const size = new TextEncoder().encode(data).length;
    this.totalUpload += size / 1024;

    uploadStats.update(this.totalUpload, this.totalUpload * 2);
    this.socket.send(data);
    this.frames[id] = performance.now();
  }
}

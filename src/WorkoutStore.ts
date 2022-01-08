import { action, makeObservable, observable, runInAction } from "mobx";
import {
  WorkoutWorker,
  WorkoutApi,
  WorkoutWorkerDelegate,
  WorkoutDisconnectStatus,
} from "./api";
import { Exercise, SkeletData, WorkoutModel } from "./models";
import { ExerciseState, QueueExercises } from "./queue";

export enum WorkoutState {
  Loading,
  InitializeFailed,
  Running,
  Hint,
  Error,
  Complete,
}

export class WorkoutRoom implements WorkoutWorkerDelegate {
  private worker?: WorkoutWorker;
  private api = new WorkoutApi();
  private _totalTimer?: number;

  public workout?: WorkoutModel;
  public queue?: QueueExercises;
  public hinted = new Set<string>();
  public progress = 0;

  public exercises: Record<string, Exercise> = {};
  public exercise: ExerciseState | null = null;
  public state: WorkoutState = WorkoutState.Loading;
  public highlightSkelet = false;
  public disconnectStatus = 0;
  public totalTime = 0;

  constructor() {
    makeObservable(this, {
      totalTime: observable,
      highlightSkelet: observable,
      disconnectStatus: observable,
      exercise: observable,
      progress: observable,
      state: observable,

      processFrame: action,
      onDidNextExercise: action,
      onDidDisconnect: action,
      onDidStart: action,
    });
  }

  async initialize(jwt: string) {
    try {
      const { workout, session } = await this.api.loadRoom(jwt);
      this.api.setAuthToken(session);
      this.workout = workout;

      this.exercises = await this.api.getExercises(workout.id);
      this.queue = new QueueExercises(workout.program.sets);
      this.queue.setPointer(0);

      this.worker = new WorkoutWorker(workout.id);
      this.worker!.delegate = this;

      this._totalTimer = setInterval(() => {
        runInAction(() => (this.totalTime += 1));
      }, 1000) as any;
    } catch {
      runInAction(() => (this.state = WorkoutState.InitializeFailed));
    }
  }

  getExercise(): Exercise | null {
    const id = this.exercise?.label;
    if (id) return this.exercises[id] ?? null;
    return null;
  }

  processFrame = (skelet: SkeletData) => {
    this.worker?.sendFrame(skelet);
  };

  async onDidCompleteExercise() {
    if (!this.queue) return;
    const exercise = this.queue.completeOne();

    this.exercise = exercise;
    this.highlightSkelet = true;
    this.progress = this.queue?.progress || 0;
    this.state = WorkoutState.Running;
    setTimeout(() => {
      runInAction(() => (this.highlightSkelet = false));
    }, 1000);

    if (exercise && !this.hinted.has(exercise.label)) {
      this.state = WorkoutState.Hint;
      this.hinted.add(exercise.label);
    }
  }

  onDidNextExercise(
    worker: WorkoutWorker,
    exercise: string,
    num: number
  ): void {
    this.queue?.setPointer(num);
    this.progress = this.queue?.progress || 0;
  }

  onDidDisconnect(worker: WorkoutWorker, status: WorkoutDisconnectStatus) {
    this.disconnectStatus = status;
    clearInterval(this._totalTimer);

    if (status === WorkoutDisconnectStatus.Success) {
      this.state = WorkoutState.Complete;
    } else {
      this.state = WorkoutState.Error;
    }
  }

  onDidStart(): void {
    console.log("onDidStart");

    this.exercise = this.queue!.currentExercise;
    this.state = WorkoutState.Hint;
    this.hinted.add(this.exercise!.label);
  }
}
